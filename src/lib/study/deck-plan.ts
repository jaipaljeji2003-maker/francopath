import { callClaude } from "@/lib/ai/claude";
import { deckPlanPrompt } from "@/lib/ai/prompts";
import type { SupabaseClient } from "@supabase/supabase-js";

const PLAN_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type DeckPlanLevel = (typeof PLAN_LEVELS)[number];

export interface DeckPlan {
  targetLevel: DeckPlanLevel;
  levelBand: {
    primary: DeckPlanLevel;
    support?: DeckPlanLevel;
    supportCapPct: number;
  };
  mix: {
    reviewPct: number;
    newPct: number;
  };
  focusTags?: string[];
  avoidTags?: string[];
  difficultyBias?: "easy" | "balanced" | "hard";
  rationale: string;
}

interface UserCardPerf {
  times_seen: number | null;
  times_correct: number | null;
  word:
    | {
        cefr_level: string | null;
      }
    | {
        cefr_level: string | null;
      }[]
    | null;
}

interface DeckPlanResult {
  plan: DeckPlan;
  cached: boolean;
  fallback: boolean;
}

function isDeckPlanLevel(level: string): level is DeckPlanLevel {
  return (PLAN_LEVELS as readonly string[]).includes(level);
}

function normalizeLevel(level: string): DeckPlanLevel {
  if (isDeckPlanLevel(level)) return level;
  if (level === "A0") return "A1";
  return "A1";
}

function oneLevelBelow(level: DeckPlanLevel): DeckPlanLevel | undefined {
  const index = PLAN_LEVELS.indexOf(level);
  if (index <= 0) return undefined;
  return PLAN_LEVELS[index - 1];
}

function sanitizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

export function validateDeckPlan(value: unknown): DeckPlan | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DeckPlan>;

  if (!candidate.targetLevel || !isDeckPlanLevel(candidate.targetLevel)) return null;
  if (!candidate.levelBand || !isDeckPlanLevel(candidate.levelBand.primary)) return null;

  if (candidate.levelBand.support && !isDeckPlanLevel(candidate.levelBand.support)) return null;
  if (candidate.levelBand.support && oneLevelBelow(candidate.levelBand.primary) !== candidate.levelBand.support) return null;

  if (!candidate.mix) return null;
  const reviewPct = Number(candidate.mix.reviewPct);
  const newPct = Number(candidate.mix.newPct);
  const supportCapPct = Number(candidate.levelBand.supportCapPct);

  if (!Number.isFinite(reviewPct) || !Number.isFinite(newPct) || reviewPct + newPct !== 100) return null;
  if (!Number.isFinite(supportCapPct) || supportCapPct < 0 || supportCapPct > 50) return null;

  const rationale = typeof candidate.rationale === "string" ? candidate.rationale.trim() : "";
  if (!rationale) return null;

  const difficultyBias = candidate.difficultyBias;
  if (difficultyBias && !["easy", "balanced", "hard"].includes(difficultyBias)) return null;

  return {
    targetLevel: candidate.targetLevel,
    levelBand: {
      primary: candidate.levelBand.primary,
      support: candidate.levelBand.support,
      supportCapPct,
    },
    mix: {
      reviewPct,
      newPct,
    },
    focusTags: sanitizeTags(candidate.focusTags),
    avoidTags: sanitizeTags(candidate.avoidTags),
    difficultyBias,
    rationale,
  };
}

function getTorontoDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getFallbackPlan(currentLevel: string, levelAccuracy: number | null): DeckPlan {
  const primary = normalizeLevel(currentLevel);
  const supportCandidate = oneLevelBelow(primary);
  const shouldSupport = typeof levelAccuracy === "number" && levelAccuracy < 70;

  return {
    targetLevel: primary,
    levelBand: {
      primary,
      support: shouldSupport ? supportCandidate : undefined,
      supportCapPct: 20,
    },
    mix: {
      reviewPct: 70,
      newPct: 30,
    },
    rationale: "Fallback plan",
  };
}

async function getPerformanceSummary(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("user_cards")
    .select("times_seen, times_correct, word:words(cefr_level)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);

  const cards = (data || []) as UserCardPerf[];
  const byLevel = new Map<string, { seen: number; correct: number }>();

  for (const card of cards) {
    const seen = card.times_seen || 0;
    const word = Array.isArray(card.word) ? card.word[0] : card.word;
    if (seen <= 0 || !word?.cefr_level) continue;
    const current = byLevel.get(word.cefr_level) || { seen: 0, correct: 0 };
    current.seen += seen;
    current.correct += card.times_correct || 0;
    byLevel.set(word.cefr_level, current);
  }

  const accuracyByLevel: Record<string, number> = {};
  byLevel.forEach((stats, level) => {
    if (stats.seen > 0) accuracyByLevel[level] = Math.round((stats.correct / stats.seen) * 100);
  });

  return { accuracyByLevel };
}

export async function getDeckPlanForUser(params: {
  supabase: SupabaseClient;
  userId: string;
  currentLevel: string;
}): Promise<DeckPlanResult> {
  const { supabase, userId, currentLevel } = params;

  const { accuracyByLevel } = await getPerformanceSummary(supabase, userId);

  const { data: cachedPlanRow } = await supabase
    .from("ai_generated_content")
    .select("content, created_at")
    .eq("user_id", userId)
    .eq("content_type", "deck_plan")
    .is("word_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cachedPlanRow?.content && cachedPlanRow.created_at) {
    const created = new Date(cachedPlanRow.created_at);
    if (getTorontoDateKey(created) === getTorontoDateKey(new Date())) {
      try {
        const parsed = JSON.parse(cachedPlanRow.content) as unknown;
        const valid = validateDeckPlan(parsed);
        if (valid) return { plan: valid, cached: true, fallback: false };
      } catch {
        // ignore and generate a fresh plan
      }
    }
  }

  const primary = normalizeLevel(currentLevel);
  const prompt = deckPlanPrompt({
    currentLevel: primary,
    levelAccuracy: accuracyByLevel[primary] ?? null,
    accuracyByLevel,
  });

  const aiResult = await callClaude({
    userId,
    prompt,
    maxTokens: 320,
  });

  let plan: DeckPlan | null = null;
  let fallback = false;

  if (!aiResult.error) {
    try {
      const parsed = JSON.parse(aiResult.content) as unknown;
      plan = validateDeckPlan(parsed);
    } catch {
      plan = null;
    }
  }

  if (!plan) {
    fallback = true;
    plan = getFallbackPlan(primary, accuracyByLevel[primary] ?? null);
  }

  await supabase.from("ai_generated_content").insert({
    user_id: userId,
    content_type: "deck_plan",
    word_id: null,
    content: JSON.stringify(plan),
    tokens_used: aiResult.tokensUsed || 0,
  });

  return { plan, cached: false, fallback };
}
