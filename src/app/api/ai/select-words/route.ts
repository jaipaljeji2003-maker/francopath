import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import { wordSelectionPrompt } from "@/lib/ai/prompts";
import { compareStudyLevels, getAdjacentLevel, getLevelDistance, normalizeStudyLevel } from "@/lib/study/levels";

type Difficulty = "easy" | "medium" | "hard";
type CandidateMode = "support" | "core" | "stretch";

type WordCandidate = {
  id: string;
  french: string;
  english: string;
  cefr_level: string;
  category: string;
  part_of_speech: string | null;
  tcf_frequency: number;
  tef_frequency: number;
  false_friend_warning: string | null;
  example_sentence: string | null;
};

type CardStatRow = {
  times_seen: number | null;
  times_correct: number | null;
  times_wrong: number | null;
  word:
    | {
        category: string | null;
        cefr_level: string | null;
      }
    | {
        category: string | null;
        cefr_level: string | null;
      }[]
    | null;
};

function getWordRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value ?? null;
}

function determineCandidateLevels(
  currentLevel: string,
  difficulty: Difficulty,
  overallAccuracy: number | null
) {
  const primaryLevel = normalizeStudyLevel(currentLevel);
  const supportLevel = getAdjacentLevel(primaryLevel, -1);
  const stretchLevel = getAdjacentLevel(primaryLevel, 1);
  const candidateLevels = [primaryLevel];
  let challengeMode: CandidateMode = "core";

  if (overallAccuracy !== null && overallAccuracy < 70 && supportLevel) {
    candidateLevels.unshift(supportLevel);
    challengeMode = "support";
  }

  const shouldStretch =
    stretchLevel &&
    difficulty !== "easy" &&
    (overallAccuracy === null
      ? difficulty === "hard"
      : overallAccuracy >= (difficulty === "hard" ? 75 : 84));

  if (shouldStretch) {
    candidateLevels.push(stretchLevel);
    challengeMode = "stretch";
  }

  return {
    candidateLevels: Array.from(new Set(candidateLevels)),
    challengeMode,
  };
}

function computeOverallAccuracy(cardStats: CardStatRow[]) {
  const totals = cardStats.reduce(
    (acc, row) => {
      acc.seen += row.times_seen || 0;
      acc.correct += row.times_correct || 0;
      return acc;
    },
    { seen: 0, correct: 0 }
  );

  if (totals.seen === 0) return null;
  return Math.round((totals.correct / totals.seen) * 100);
}

function getWeakCategories(cardStats: CardStatRow[]) {
  const categoryStats: Record<string, { seen: number; correct: number }> = {};

  for (const row of cardStats) {
    const word = getWordRelation(row.word);
    const category = word?.category?.trim();
    if (!category) continue;
    if (!categoryStats[category]) categoryStats[category] = { seen: 0, correct: 0 };
    categoryStats[category].seen += row.times_seen || 0;
    categoryStats[category].correct += row.times_correct || 0;
  }

  return Object.entries(categoryStats)
    .filter(([, stats]) => stats.seen > 0)
    .sort((left, right) => {
      const leftAccuracy = left[1].correct / left[1].seen;
      const rightAccuracy = right[1].correct / right[1].seen;
      return leftAccuracy - rightAccuracy;
    })
    .slice(0, 5)
    .map(([category]) => category);
}

function extractWritingWeaknesses(drills: Array<{ ai_grading: any }> | null) {
  const weaknessCounts = new Map<string, number>();

  for (const drill of drills || []) {
    const grading = drill.ai_grading;
    if (!grading || typeof grading !== "object") continue;

    const criteriaScores = grading.criteria_scores;
    if (criteriaScores && typeof criteriaScores === "object") {
      for (const [criterion, value] of Object.entries(criteriaScores)) {
        const score = typeof value === "object" && value && "score" in value ? Number((value as any).score) : NaN;
        if (Number.isFinite(score) && score <= 2) {
          weaknessCounts.set(criterion.replace(/_/g, " "), (weaknessCounts.get(criterion.replace(/_/g, " ")) || 0) + 2);
        }
      }
    }

    if (Array.isArray(grading.errors)) {
      for (const error of grading.errors) {
        const label =
          error?.category ||
          error?.rule ||
          error?.original ||
          null;

        if (typeof label === "string" && label.trim()) {
          weaknessCounts.set(label.trim(), (weaknessCounts.get(label.trim()) || 0) + 1);
        }
      }
    }

    if (Array.isArray(grading.vocab_to_review)) {
      for (const item of grading.vocab_to_review) {
        if (typeof item === "string" && item.trim()) {
          weaknessCounts.set(`vocab: ${item.trim()}`, (weaknessCounts.get(`vocab: ${item.trim()}`) || 0) + 1);
        }
      }
    }
  }

  return Array.from(weaknessCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([label]) => label);
}

function getDifficultyWeight(word: WordCandidate, difficulty: Difficulty, targetExam: "TCF" | "TEF") {
  const frequency = targetExam === "TCF" ? word.tcf_frequency : word.tef_frequency;

  if (difficulty === "easy") {
    return frequency * 4;
  }

  if (difficulty === "hard") {
    return (11 - frequency) * 4 + (frequency <= 4 ? 6 : 0);
  }

  return 28 - Math.abs(6 - frequency) * 5;
}

function scoreCandidateWord(params: {
  word: WordCandidate;
  difficulty: Difficulty;
  targetExam: "TCF" | "TEF";
  currentLevel: string;
  weakCategories: string[];
  challengeMode: CandidateMode;
}) {
  const { word, difficulty, targetExam, currentLevel, weakCategories, challengeMode } = params;
  const frequency = targetExam === "TCF" ? word.tcf_frequency : word.tef_frequency;
  const weakCategoryBoost = weakCategories.includes(word.category) ? 14 : 0;
  const levelDistance = getLevelDistance(word.cefr_level, currentLevel);
  const falseFriendBoost = word.false_friend_warning ? 9 : 0;
  const sentenceBoost = word.example_sentence ? 4 : 0;
  const partOfSpeechBoost = word.part_of_speech && !["interjection", "article"].includes(word.part_of_speech) ? 4 : 0;
  const sloppyEasyPenalty =
    difficulty !== "easy" &&
    ["greetings", "numbers", "months", "days", "colors"].includes(word.category.toLowerCase())
      ? 12
      : 0;

  let modeBoost = 0;
  if (challengeMode === "stretch" && compareStudyLevels(word.cefr_level, currentLevel) > 0) modeBoost += 12;
  if (challengeMode === "support" && compareStudyLevels(word.cefr_level, currentLevel) < 0) modeBoost += 8;
  if (challengeMode === "core" && levelDistance === 0) modeBoost += 8;

  return (
    getDifficultyWeight(word, difficulty, targetExam) +
    weakCategoryBoost +
    falseFriendBoost +
    sentenceBoost +
    partOfSpeechBoost +
    modeBoost +
    frequency * 2 -
    levelDistance * 6 -
    sloppyEasyPenalty
  );
}

function fallbackWordSelection(params: {
  availableWords: WordCandidate[];
  count: number;
  difficulty: Difficulty;
  targetExam: "TCF" | "TEF";
  currentLevel: string;
  weakCategories: string[];
  challengeMode: CandidateMode;
}) {
  const rankedWords = [...params.availableWords].sort(
    (left, right) =>
      scoreCandidateWord({
        word: right,
        difficulty: params.difficulty,
        targetExam: params.targetExam,
        currentLevel: params.currentLevel,
        weakCategories: params.weakCategories,
        challengeMode: params.challengeMode,
      }) -
      scoreCandidateWord({
        word: left,
        difficulty: params.difficulty,
        targetExam: params.targetExam,
        currentLevel: params.currentLevel,
        weakCategories: params.weakCategories,
        challengeMode: params.challengeMode,
      })
  );

  const selected: string[] = [];
  const categoryCounts: Record<string, number> = {};
  const levelCounts: Record<string, number> = {};

  for (const word of rankedWords) {
    if (selected.length >= params.count) break;

    const categoryCount = categoryCounts[word.category] || 0;
    const levelCount = levelCounts[word.cefr_level] || 0;
    const tooManyFromCategory = categoryCount >= 2 && rankedWords.length > params.count * 2;
    const tooManyFromLevel = levelCount >= Math.max(2, Math.ceil(params.count * 0.7));

    if (tooManyFromCategory || tooManyFromLevel) continue;

    selected.push(word.id);
    categoryCounts[word.category] = categoryCount + 1;
    levelCounts[word.cefr_level] = levelCount + 1;
  }

  if (selected.length < params.count) {
    const selectedSet = new Set(selected);
    for (const word of rankedWords) {
      if (selected.length >= params.count) break;
      if (selectedSet.has(word.id)) continue;
      selected.push(word.id);
      selectedSet.add(word.id);
    }
  }

  return selected;
}

/**
 * POST /api/ai/select-words
 * AI picks personalized words for the user's daily deck.
 * Creates user_cards rows for selected words.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count, difficulty } = await req.json();
  if (!count || count < 1 || count > 20) {
    return NextResponse.json({ error: "count must be 1-20" }, { status: 400 });
  }
  if (!["easy", "medium", "hard"].includes(difficulty)) {
    return NextResponse.json({ error: "difficulty must be easy, medium, or hard" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, target_exam, target_exam_date, native_languages")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: existingCards } = await supabase
    .from("user_cards")
    .select("word_id")
    .eq("user_id", user.id);

  const { data: cardStats } = await supabase
    .from("user_cards")
    .select("times_seen, times_correct, times_wrong, word:words!inner(category, cefr_level)")
    .eq("user_id", user.id)
    .gt("times_seen", 0)
    .limit(500);

  const overallAccuracy = computeOverallAccuracy((cardStats || []) as CardStatRow[]);
  const weakCategories = getWeakCategories((cardStats || []) as CardStatRow[]);
  const { candidateLevels, challengeMode } = determineCandidateLevels(
    profile.current_level || "A1",
    difficulty as Difficulty,
    overallAccuracy
  );

  const existingWordIds = new Set((existingCards || []).map((card) => card.word_id));

  const { data: allCandidateWords } = await supabase
    .from("words")
    .select("id, french, english, cefr_level, category, part_of_speech, tcf_frequency, tef_frequency, false_friend_warning, example_sentence")
    .in("cefr_level", candidateLevels);

  const availableWords = ((allCandidateWords || []) as WordCandidate[])
    .filter((word) => !existingWordIds.has(word.id))
    .sort((left, right) => compareStudyLevels(left.cefr_level, right.cefr_level));

  if (availableWords.length === 0) {
    return NextResponse.json({ error: "No available words in the current study band", selected: [] }, { status: 200 });
  }

  const actualCount = Math.min(count, availableWords.length);

  const { data: existingWordsData } = await supabase
    .from("user_cards")
    .select("word:words!inner(french)")
    .eq("user_id", user.id)
    .limit(100);

  const existingFrenchWords = (existingWordsData || [])
    .map((card: any) => getWordRelation(card.word)?.french)
    .filter(Boolean);

  const { data: recentWritingDrills } = await supabase
    .from("exam_drills")
    .select("ai_grading")
    .eq("user_id", user.id)
    .eq("drill_type", "writing")
    .order("completed_at", { ascending: false })
    .limit(5);

  const writingWeaknesses = extractWritingWeaknesses(recentWritingDrills as Array<{ ai_grading: any }> | null);

  const rankedCandidatePool = [...availableWords]
    .sort(
      (left, right) =>
        scoreCandidateWord({
          word: right,
          difficulty: difficulty as Difficulty,
          targetExam: (profile.target_exam || "TCF") as "TCF" | "TEF",
          currentLevel: profile.current_level || "A1",
          weakCategories,
          challengeMode,
        }) -
        scoreCandidateWord({
          word: left,
          difficulty: difficulty as Difficulty,
          targetExam: (profile.target_exam || "TCF") as "TCF" | "TEF",
          currentLevel: profile.current_level || "A1",
          weakCategories,
          challengeMode,
        })
    )
    .slice(0, 80);

  let selectedIds: string[] = [];
  let reasoning = "";
  let theme: string | null = null;
  let usedFallback = false;

  try {
    const prompt = wordSelectionPrompt({
      level: profile.current_level || "A1",
      count: actualCount,
      difficulty: difficulty as Difficulty,
      targetExam: (profile.target_exam || "TCF") as "TCF" | "TEF",
      nativeLanguages: profile.native_languages || ["en"],
      overallAccuracy,
      candidateLevels,
      challengeMode,
      targetExamDate: profile.target_exam_date,
      existingFrenchWords,
      weakCategories,
      writingWeaknesses,
      availableWords: rankedCandidatePool,
    });

    const response = await callClaude({ userId: user.id, prompt, maxTokens: 650 });

    if (response.content && !response.error) {
      const parsed = JSON.parse(response.content);
      const validIds = new Set(rankedCandidatePool.map((word) => word.id));
      const aiIds = (parsed.selected_word_ids || []).filter((id: string) => validIds.has(id));

      if (aiIds.length >= actualCount) {
        selectedIds = aiIds.slice(0, actualCount);
        reasoning = parsed.selection_reasoning || "";
        theme = parsed.theme || null;
      }
    }
  } catch {
    // Fall back to deterministic ranking if AI selection is unavailable or malformed.
  }

  if (selectedIds.length < actualCount) {
    usedFallback = true;
    selectedIds = fallbackWordSelection({
      availableWords: rankedCandidatePool,
      count: actualCount,
      difficulty: difficulty as Difficulty,
      targetExam: (profile.target_exam || "TCF") as "TCF" | "TEF",
      currentLevel: profile.current_level || "A1",
      weakCategories,
      challengeMode,
    });
    reasoning = "Selected from the highest-value candidate pool using exam frequency, weak areas, and challenge fit.";
  }

  const newCards = selectedIds.map((wordId) => ({ user_id: user.id, word_id: wordId }));
  if (newCards.length > 0) {
    await supabase
      .from("user_cards")
      .upsert(newCards, { onConflict: "user_id,word_id", ignoreDuplicates: true });
  }

  const { data: selectedWords } = await supabase
    .from("words")
    .select("*")
    .in("id", selectedIds);

  const selectedLevels = Array.from(
    new Set((selectedWords || []).map((word: any) => word.cefr_level).filter(Boolean))
  ).sort(compareStudyLevels);

  return NextResponse.json({
    selected: selectedWords || [],
    count: selectedIds.length,
    reasoning,
    theme,
    fallback: usedFallback,
    levels: selectedLevels,
    strategy: challengeMode,
    weakCategories,
  });
}
