import StudyClient from "@/components/study/StudyClient";
import { createClient } from "@/lib/supabase/server";
import { getDeckPlanForUser, type DeckPlan } from "@/lib/study/deck-plan";
import { redirect } from "next/navigation";

type StudyCard = {
  id: string;
  word_id: string;
  ease_factor: number;
  interval_days: number;
  repetition: number;
  next_review: string;
  times_seen: number;
  times_correct: number;
  times_wrong: number;
  status: string;
  ai_mnemonic: string | null;
  created_at: string;
  word: {
    french: string;
    english: string;
    hindi: string | null;
    punjabi: string | null;
    part_of_speech: string | null;
    gender: string | null;
    cefr_level: string;
    category: string;
    subcategory: string | null;
    example_sentence: string | null;
    false_friend_warning: string | null;
    notes: string | null;
  };
};

const LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;
const DEFAULT_DAILY_GOAL = 20;
const DEFAULT_SESSION_LIMIT = 25;
const MIN_GOAL = 5;
const MAX_GOAL = 100;
const UNLIMITED_SENTINEL = 999;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  return Math.max(min, Math.min(max, normalized));
}

function oneLevelBelow(level: string): string | undefined {
  const index = LEVELS.indexOf(level as (typeof LEVELS)[number]);
  if (index <= 0) return undefined;
  return LEVELS[index - 1];
}

function getAllowedLevels(currentLevel: string): string[] {
  const primary = LEVELS.includes(currentLevel as (typeof LEVELS)[number]) ? currentLevel : "A1";
  const support = oneLevelBelow(primary);
  return support ? [primary, support] : [primary];
}

function hasFocusTag(card: StudyCard, tags: string[]): boolean {
  const category = card.word.category.toLowerCase();
  const subcategory = card.word.subcategory?.toLowerCase() || "";
  return tags.some((tag) => {
    const normalized = tag.toLowerCase();
    return category.includes(normalized) || subcategory.includes(normalized);
  });
}

function hasAvoidTag(card: StudyCard, tags: string[]): boolean {
  const category = card.word.category.toLowerCase();
  const subcategory = card.word.subcategory?.toLowerCase() || "";
  return tags.some((tag) => {
    const normalized = tag.toLowerCase();
    return category.includes(normalized) || subcategory.includes(normalized);
  });
}

function sortCards(cards: StudyCard[], type: "review" | "new", plan: DeckPlan): StudyCard[] {
  const focusTags = plan.focusTags || [];
  const avoidTags = plan.avoidTags || [];

  return [...cards].sort((a, b) => {
    const aFocus = focusTags.length > 0 && hasFocusTag(a, focusTags) ? 1 : 0;
    const bFocus = focusTags.length > 0 && hasFocusTag(b, focusTags) ? 1 : 0;
    if (aFocus !== bFocus) return bFocus - aFocus;

    const aAvoid = avoidTags.length > 0 && hasAvoidTag(a, avoidTags) ? 1 : 0;
    const bAvoid = avoidTags.length > 0 && hasAvoidTag(b, avoidTags) ? 1 : 0;
    if (aAvoid !== bAvoid) return aAvoid - bAvoid;

    const aPrimaryTime = type === "review" ? a.next_review : a.created_at;
    const bPrimaryTime = type === "review" ? b.next_review : b.created_at;
    const byTime = aPrimaryTime.localeCompare(bPrimaryTime);
    if (byTime !== 0) return byTime;

    return a.word_id.localeCompare(b.word_id);
  });
}

function pickWithSupportCap(params: {
  cards: StudyCard[];
  quota: number;
  plan: DeckPlan;
  type: "review" | "new";
}): StudyCard[] {
  const { cards, quota, plan, type } = params;
  if (quota <= 0) return [];

  const primaryLevel = plan.levelBand.primary;
  const supportLevel = plan.levelBand.support;
  const maxSupport = Math.floor((quota * plan.levelBand.supportCapPct) / 100);

  const sorted = sortCards(cards, type, plan);
  const primary = sorted.filter((card) => card.word.cefr_level === primaryLevel).slice(0, quota);

  if (primary.length >= quota || !supportLevel || maxSupport <= 0) return primary;

  const supportNeeded = Math.min(maxSupport, quota - primary.length);
  const support = sorted
    .filter((card) => card.word.cefr_level === supportLevel && !primary.some((picked) => picked.id === card.id))
    .slice(0, supportNeeded);

  return [...primary, ...support];
}

export default async function StudyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile?.onboarding_complete) redirect("/placement");

  const dailyGoal = clamp(profile.daily_goal, MIN_GOAL, MAX_GOAL, DEFAULT_DAILY_GOAL);
  const rawSessionLimit = profile.session_limit;
  const sessionLimit =
    rawSessionLimit === UNLIMITED_SENTINEL
      ? Number.POSITIVE_INFINITY
      : rawSessionLimit == null
        ? dailyGoal
        : clamp(rawSessionLimit, MIN_GOAL, MAX_GOAL, DEFAULT_SESSION_LIMIT);
  const now = new Date().toISOString();
  const allowedLevels = getAllowedLevels(profile.current_level || "A1");

  const { plan } = await getDeckPlanForUser({
    supabase,
    userId: user.id,
    currentLevel: profile.current_level,
  });

  const reviewQuota = Math.min(dailyGoal, Math.round((dailyGoal * plan.mix.reviewPct) / 100));
  const newQuota = Math.max(0, dailyGoal - reviewQuota);

  const { data: dueCards } = await supabase
    .from("user_cards")
    .select("*, word:words(*)")
    .eq("user_id", user.id)
    .lte("next_review", now)
    .gt("times_seen", 0)
    .neq("status", "burned")
    .order("next_review", { ascending: true })
    .order("word_id", { ascending: true })
    .limit(Number.isFinite(sessionLimit) ? sessionLimit * 4 : MAX_GOAL * 20);

  const eligibleDueCards = ((dueCards || []) as StudyCard[]).filter((card) => allowedLevels.includes(card.word.cefr_level));

  const pickedReviews = pickWithSupportCap({
    cards: eligibleDueCards,
    quota: reviewQuota,
    plan,
    type: "review",
  });

  const pickedReviewIds = new Set(pickedReviews.map((card) => card.id));

  const { data: newCards } = await supabase
    .from("user_cards")
    .select("*, word:words(*)")
    .eq("user_id", user.id)
    .eq("times_seen", 0)
    .neq("status", "burned")
    .order("created_at", { ascending: true })
    .order("word_id", { ascending: true })
    .limit(Number.isFinite(sessionLimit) ? sessionLimit * 4 : MAX_GOAL * 20);

  const eligibleNew = ((newCards || []) as StudyCard[]).filter(
    (card) => !pickedReviewIds.has(card.id) && allowedLevels.includes(card.word.cefr_level),
  );
  const pickedNew = pickWithSupportCap({ cards: eligibleNew, quota: newQuota, plan, type: "new" });

  const queue = [...pickedReviews, ...pickedNew].slice(0, sessionLimit);

  return (
    <StudyClient
      cards={queue}
      userId={user.id}
      preferredLang={profile.preferred_translation || "en"}
      dailyGoal={dailyGoal}
      deckPlanSummary={`Today: ${plan.levelBand.primary}${plan.levelBand.support ? ` + ${plan.levelBand.support} support` : ""} · ${plan.mix.reviewPct}/${plan.mix.newPct} review/new`}
    />
  );
}
