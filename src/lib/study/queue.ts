import type { DeckPlan } from "@/lib/study/deck-plan";
import { getLevelDistance, normalizeStudyLevel } from "@/lib/study/levels";

type QueueWord = {
  french?: string;
  cefr_level: string;
  category: string;
  tcf_frequency?: number | null;
  tef_frequency?: number | null;
  false_friend_warning?: string | null;
  example_sentence?: string | null;
};

export type QueueCard = {
  id: string;
  next_review: string;
  created_at?: string;
  times_seen: number;
  times_correct: number;
  times_wrong: number;
  ease_factor: number;
  repetition: number;
  status: string;
  word: QueueWord;
};

interface ReviewFocus {
  weaknessLabels?: string[];
  vocabToReview?: string[];
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function getExamFrequency(card: QueueCard, examType: "TCF" | "TEF") {
  const value = examType === "TCF"
    ? card.word.tcf_frequency ?? 0
    : card.word.tef_frequency ?? 0;

  return Number.isFinite(value) ? Number(value) : 0;
}

function getOverdueDays(nextReview: string) {
  const deltaMs = Date.now() - new Date(nextReview).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return deltaMs / (1000 * 60 * 60 * 24);
}

function scoreDueCard(
  card: QueueCard,
  examType: "TCF" | "TEF",
  currentLevel: string,
  focusTags: Set<string>,
  reviewWords: Set<string>
) {
  const overdueDays = getOverdueDays(card.next_review);
  const lapseRate = card.times_seen > 0 ? card.times_wrong / card.times_seen : 0;
  const levelDistance = getLevelDistance(card.word.cefr_level, currentLevel);
  const category = normalizeTag(card.word.category);
  const isTargetReviewWord = reviewWords.has(card.word.french?.toLowerCase?.() || "");
  const categoryBoost = focusTags.has(category) ? 10 : 0;
  const falseFriendBoost = card.word.false_friend_warning ? 6 : 0;
  const frequencyBoost = getExamFrequency(card, examType) * 1.8;
  const easePenalty = Math.max(0, 2.6 - card.ease_factor) * 14;
  const lapseBoost = lapseRate * 35;
  const urgencyBoost = overdueDays * 22;
  const levelPenalty = levelDistance * 4;
  const targetWordBoost = isTargetReviewWord ? 18 : 0;

  return (
    urgencyBoost +
    lapseBoost +
    easePenalty +
    frequencyBoost +
    categoryBoost +
    targetWordBoost +
    falseFriendBoost -
    levelPenalty
  );
}

function scoreNewCard(
  card: QueueCard,
  examType: "TCF" | "TEF",
  currentLevel: string,
  plan: DeckPlan,
  focusTags: Set<string>,
  reviewWords: Set<string>
) {
  const examFrequency = getExamFrequency(card, examType);
  const level = normalizeStudyLevel(card.word.cefr_level);
  const levelDistance = getLevelDistance(level, currentLevel);
  const category = normalizeTag(card.word.category);
  const isTargetReviewWord = reviewWords.has(card.word.french?.toLowerCase?.() || "");
  const categoryBoost = focusTags.has(category) ? 14 : 0;
  const falseFriendBoost = card.word.false_friend_warning ? 10 : 0;
  const sentenceBoost = card.word.example_sentence ? 4 : 0;
  const targetWordBoost = isTargetReviewWord ? 16 : 0;

  let difficultyScore = 0;
  if (plan.difficultyBias === "hard") {
    difficultyScore = (11 - examFrequency) * 4 + (level === plan.targetLevel ? 8 : 0);
  } else if (plan.difficultyBias === "easy") {
    difficultyScore = examFrequency * 4 + (levelDistance === 0 ? 8 : 0);
  } else {
    difficultyScore = 32 - Math.abs(6 - examFrequency) * 5;
  }

  let levelFitBoost = 0;
  if (level === plan.levelBand.primary) levelFitBoost += 16;
  if (plan.levelBand.support && level === plan.levelBand.support) levelFitBoost += 8;
  if (level === plan.targetLevel) levelFitBoost += 6;

  const sloppyEasyCategories = new Set([
    "greetings",
    "numbers",
    "colors",
    "months",
    "days",
  ]);
  const sloppyPenalty =
    (plan.difficultyBias === "hard" || levelDistance === 0) && sloppyEasyCategories.has(category)
      ? 12
      : 0;

  return (
    difficultyScore +
    levelFitBoost +
    categoryBoost +
    targetWordBoost +
    falseFriendBoost +
    sentenceBoost +
    examFrequency * 2 -
    levelDistance * 5 -
    sloppyPenalty
  );
}

function selectNewCardsWithSupportCap(
  cards: QueueCard[],
  count: number,
  plan: DeckPlan
) {
  if (count <= 0) return [] as QueueCard[];

  const primaryCards = cards.filter((card) => card.word.cefr_level === plan.levelBand.primary);
  const supportCards = plan.levelBand.support
    ? cards.filter((card) => card.word.cefr_level === plan.levelBand.support)
    : [];
  const challengeCards = cards.filter(
    (card) =>
      card.word.cefr_level !== plan.levelBand.primary &&
      card.word.cefr_level !== plan.levelBand.support
  );

  const selected: QueueCard[] = [];
  const supportCap = plan.levelBand.support
    ? Math.min(
        supportCards.length,
        Math.max(1, Math.ceil((count * plan.levelBand.supportCapPct) / 100))
      )
    : 0;

  selected.push(...primaryCards.slice(0, count));

  if (selected.length < count && supportCap > 0) {
    selected.push(...supportCards.slice(0, Math.min(supportCap, count - selected.length)));
  }

  if (selected.length < count) {
    const supportRemainder = supportCards.slice(supportCap);
    const fallbackPool = [...challengeCards, ...supportRemainder];
    selected.push(...fallbackPool.slice(0, count - selected.length));
  }

  return selected.slice(0, count);
}

function interleaveCards(dueCards: QueueCard[], newCards: QueueCard[]) {
  if (dueCards.length === 0) return newCards;
  if (newCards.length === 0) return dueCards;

  const result: QueueCard[] = [];
  let dueIndex = 0;
  let newIndex = 0;
  const interval = Math.max(2, Math.round(dueCards.length / Math.max(newCards.length, 1)));

  while (dueIndex < dueCards.length || newIndex < newCards.length) {
    for (let i = 0; i < interval && dueIndex < dueCards.length; i += 1) {
      result.push(dueCards[dueIndex]);
      dueIndex += 1;
    }

    if (newIndex < newCards.length) {
      result.push(newCards[newIndex]);
      newIndex += 1;
    }
  }

  return result;
}

export function buildPersonalizedStudyQueue(params: {
  dueCards: QueueCard[];
  newCards: QueueCard[];
  maxCards: number;
  examType: "TCF" | "TEF";
  currentLevel: string;
  plan: DeckPlan;
  reviewFocus?: ReviewFocus;
}) {
  const focusTags = new Set([
    ...(params.plan.focusTags || []).map(normalizeTag),
    ...((params.reviewFocus?.weaknessLabels || []).map(normalizeTag)),
  ]);
  const reviewWords = new Set(
    (params.reviewFocus?.vocabToReview || []).map((word) => word.trim().toLowerCase())
  );
  const dueCards = [...params.dueCards].sort(
    (left, right) =>
      scoreDueCard(right, params.examType, params.currentLevel, focusTags, reviewWords) -
      scoreDueCard(left, params.examType, params.currentLevel, focusTags, reviewWords)
  );

  if (dueCards.length >= params.maxCards) {
    return dueCards.slice(0, params.maxCards);
  }

  const remainingSlots = params.maxCards - dueCards.length;
  const rankedNewCards = [...params.newCards].sort(
    (left, right) =>
      scoreNewCard(right, params.examType, params.currentLevel, params.plan, focusTags, reviewWords) -
      scoreNewCard(left, params.examType, params.currentLevel, params.plan, focusTags, reviewWords)
  );

  const selectedNewCards = selectNewCardsWithSupportCap(
    rankedNewCards,
    remainingSlots,
    params.plan
  );

  return interleaveCards(dueCards, selectedNewCards).slice(0, params.maxCards);
}
