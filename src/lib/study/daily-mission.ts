import type { DeckPlan } from "@/lib/study/deck-plan";

export type MissionDifficulty = "easy" | "medium" | "hard";
export type MissionMode = "review-first" | "balanced" | "build";

export interface DailyMission {
  mode: MissionMode;
  recommendedNewWords: number;
  recommendedDifficulty: MissionDifficulty;
  title: string;
  summary: string;
  reason: string;
  levelBandLabel: string;
  ctaLabel: string;
}

const NEW_WORD_STEPS = [0, 3, 5, 8, 10, 15];

function clampDifficulty(value: number) {
  return Math.max(0, Math.min(2, value));
}

function difficultyToIndex(difficulty: MissionDifficulty) {
  if (difficulty === "easy") return 0;
  if (difficulty === "hard") return 2;
  return 1;
}

function indexToDifficulty(index: number): MissionDifficulty {
  if (index <= 0) return "easy";
  if (index >= 2) return "hard";
  return "medium";
}

function shiftDifficulty(base: MissionDifficulty, delta: -1 | 0 | 1): MissionDifficulty {
  return indexToDifficulty(clampDifficulty(difficultyToIndex(base) + delta));
}

export function snapNewWordCount(desiredCount: number, availableCount: number): number {
  const cappedDesired = Math.max(0, Math.min(desiredCount, availableCount));
  return [...NEW_WORD_STEPS].reverse().find((option) => option <= cappedDesired) ?? 0;
}

export function buildLevelBandLabel(plan: DeckPlan): string {
  return plan.levelBand.support
    ? `${plan.levelBand.primary} + ${plan.levelBand.support} support`
    : plan.levelBand.primary;
}

function getBaseDifficulty(plan: DeckPlan): MissionDifficulty {
  if (plan.difficultyBias === "easy") return "easy";
  if (plan.difficultyBias === "hard") return "hard";
  return "medium";
}

export function recommendDailyMission(params: {
  dueCount: number;
  availableNewWordCount: number;
  dailyGoal: number;
  plan: DeckPlan;
}): DailyMission {
  const { dueCount, availableNewWordCount, dailyGoal, plan } = params;
  const levelBandLabel = buildLevelBandLabel(plan);
  const baseNewTarget = snapNewWordCount(
    Math.max(3, Math.round(dailyGoal * (plan.mix.newPct / 100))),
    availableNewWordCount
  );
  const baseDifficulty = getBaseDifficulty(plan);

  let mode: MissionMode = "balanced";
  let recommendedNewWords = baseNewTarget;
  let recommendedDifficulty = baseDifficulty;
  let title = "Balanced exam session";
  let summary =
    "Protect retention with due reviews first, then add a focused batch of exam-relevant words.";

  if (availableNewWordCount === 0) {
    mode = "review-first";
    recommendedNewWords = 0;
    recommendedDifficulty = shiftDifficulty(baseDifficulty, -1);
    title = "Review and consolidate";
    summary =
      dueCount > 0
        ? "No worthwhile new words are ready right now, so use today to lock in what you already have."
        : "There are no strong new additions available right now, so a lighter consolidation day makes more sense.";
  } else if (dueCount >= Math.max(12, dailyGoal + 2)) {
    mode = "review-first";
    recommendedNewWords = snapNewWordCount(Math.min(3, baseNewTarget), availableNewWordCount);
    recommendedDifficulty = shiftDifficulty(baseDifficulty, -1);
    title = "Review first, then add a small batch";
    summary =
      "Your queue is heavy today. Keep the new load tight so overdue cards do not start slipping.";
  } else if (dueCount >= 6) {
    mode = "balanced";
    recommendedNewWords = snapNewWordCount(
      Math.max(3, Math.min(5, baseNewTarget || 5)),
      availableNewWordCount
    );
    recommendedDifficulty = shiftDifficulty(baseDifficulty, 0);
    title = "Balanced review and growth";
    summary =
      "You have enough review pressure to stay honest, but there is still room for a focused set of new exam words.";
  } else {
    mode = "build";
    recommendedNewWords = snapNewWordCount(
      Math.max(baseNewTarget || 5, dailyGoal >= 12 ? 5 : 3),
      availableNewWordCount
    );
    recommendedDifficulty = shiftDifficulty(baseDifficulty, dueCount === 0 ? 1 : 0);
    title = dueCount === 0 ? "Build new exam vocabulary" : "Keep momentum with new words";
    summary =
      dueCount === 0
        ? "Your review load is light, so today is a good time to push into fresh vocabulary with real exam value."
        : "Your review load is manageable, so you can safely expand without turning the session into busywork.";
  }

  const ctaLabel =
    dueCount > 0 || recommendedNewWords > 0
      ? `Start ${recommendedNewWords} new + ${dueCount} review`
      : "No cards ready";

  return {
    mode,
    recommendedNewWords,
    recommendedDifficulty,
    title,
    summary,
    reason: plan.rationale,
    levelBandLabel,
    ctaLabel,
  };
}
