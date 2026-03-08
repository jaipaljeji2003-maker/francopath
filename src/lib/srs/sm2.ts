/**
 * FrancoPath review scheduler.
 *
 * This keeps the familiar SM-2 style ease factor, but adds:
 * - a distinct "barely knew it" lane
 * - same-day relearning steps for lapses
 * - softer interval growth for shaky recalls
 * - overdue bonus for cards remembered after waiting longer than planned
 */

export interface SRSData {
  easeFactor: number;
  intervalDays: number;
  repetition: number;
  nextReview: string; // ISO date
  lastReview: string | null;
}

export interface SRSResult extends SRSData {
  isCorrect: boolean;
  status: "new" | "learning" | "review" | "mastered";
}

function scheduleFromNow(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

function scheduleFromDays(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

export function calculateSRS(
  current: SRSData,
  quality: number // 1-5
): SRSResult {
  let { easeFactor, intervalDays, repetition } = current;
  const isCorrect = quality >= 3;
  const overdueDays = Math.max(
    0,
    (Date.now() - new Date(current.nextReview).getTime()) / (1000 * 60 * 60 * 24)
  );
  const overdueBonus =
    intervalDays > 0
      ? 1 + Math.min(0.35, overdueDays / Math.max(10, intervalDays * 4))
      : 1;
  let nextReview = current.nextReview;

  if (!isCorrect) {
    repetition = 0;

    if (quality <= 1) {
      intervalDays = 0;
      nextReview = scheduleFromNow(10);
      easeFactor = Math.max(1.3, easeFactor - 0.28);
    } else {
      intervalDays = 0;
      nextReview = scheduleFromNow(12 * 60);
      easeFactor = Math.max(1.3, easeFactor - 0.18);
    }
  } else {
    if (quality === 3) {
      if (repetition === 0) intervalDays = 1;
      else if (repetition === 1) intervalDays = 2;
      else intervalDays = Math.max(1, Math.round(intervalDays * Math.max(1.2, easeFactor - 0.15) * overdueBonus));
      easeFactor = Math.max(1.3, easeFactor - 0.05);
    } else if (quality === 4) {
      if (repetition === 0) intervalDays = 2;
      else if (repetition === 1) intervalDays = 4;
      else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor * overdueBonus));
      easeFactor = Math.max(1.3, easeFactor + 0.03);
    } else {
      if (repetition === 0) intervalDays = 3;
      else if (repetition === 1) intervalDays = 6;
      else intervalDays = Math.max(1, Math.round(intervalDays * (easeFactor + 0.2) * 1.15 * overdueBonus));
      easeFactor = Math.max(1.3, easeFactor + 0.1);
    }

    repetition += 1;
    intervalDays = Math.min(intervalDays, 365);
    nextReview = scheduleFromDays(intervalDays);
  }

  let status: SRSResult["status"];
  if (!isCorrect || intervalDays < 3) status = "learning";
  else if (repetition >= 6 && easeFactor >= 2.45 && intervalDays >= 21) status = "mastered";
  else if (intervalDays >= 3) status = "review";
  else status = "learning";

  return {
    easeFactor,
    intervalDays,
    repetition,
    nextReview,
    lastReview: new Date().toISOString(),
    isCorrect,
    status,
  };
}

/**
 * Legacy helper for simple queue building in places that still use it.
 * The study page now uses a richer queue builder in /lib/study/queue.
 */
export function buildReviewQueue(
  cards: Array<{
    id: string;
    nextReview: string;
    status: string;
    timesSeen: number;
    easeFactor: number;
  }>,
  options: {
    maxCards?: number;
    newCardRatio?: number;
    accuracy?: number;
  } = {}
) {
  const { maxCards = 10, accuracy = 75 } = options;
  const now = new Date().toISOString();

  const dueCards = cards
    .filter((c) => c.nextReview <= now && c.timesSeen > 0)
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview));

  const newCards = cards
    .filter((c) => c.timesSeen === 0)
    .sort(() => Math.random() - 0.5);

  const newRatio = accuracy >= 85 ? 0.3 : accuracy >= 70 ? 0.2 : 0.1;
  const newCount = Math.round(maxCards * newRatio);
  const reviewCount = maxCards - newCount;

  return [...dueCards.slice(0, reviewCount), ...newCards.slice(0, newCount)].slice(0, maxCards);
}
