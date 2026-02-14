/**
 * SM-2 Spaced Repetition Algorithm
 * Adapted for FrancoPath TCF/TEF preparation
 *
 * Quality ratings:
 * 1 = Forgot completely (blackout)
 * 2 = Hard (wrong but recognized after seeing answer)
 * 3 = Okay (correct but with difficulty)
 * 4 = Good (correct with some hesitation)
 * 5 = Easy (instant recall)
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

export function calculateSRS(
  current: SRSData,
  quality: number // 1-5
): SRSResult {
  let { easeFactor, intervalDays, repetition } = current;
  const isCorrect = quality >= 3;

  if (isCorrect) {
    // Correct answer — increase interval
    if (repetition === 0) {
      intervalDays = 1;
    } else if (repetition === 1) {
      intervalDays = 3;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetition++;
  } else {
    // Wrong — reset to beginning
    repetition = 0;
    intervalDays = 1;
  }

  // Update ease factor (minimum 1.3)
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Cap interval at 180 days
  intervalDays = Math.min(intervalDays, 180);

  // Calculate next review date
  const nextReview = new Date(
    Date.now() + intervalDays * 24 * 60 * 60 * 1000
  ).toISOString();

  // Determine card status
  let status: SRSResult["status"];
  if (repetition === 0) status = "learning";
  else if (repetition >= 5 && easeFactor >= 2.0) status = "mastered";
  else if (intervalDays >= 7) status = "review";
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
 * Build an optimized review queue based on user's progress
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

  // Separate due and new cards
  const dueCards = cards
    .filter((c) => c.nextReview <= now && c.timesSeen > 0)
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview));

  const newCards = cards
    .filter((c) => c.timesSeen === 0)
    .sort(() => Math.random() - 0.5);

  // Adaptive ratio: more review if accuracy is low
  const newRatio = accuracy >= 80 ? 0.4 : accuracy >= 60 ? 0.25 : 0.15;
  const newCount = Math.round(maxCards * newRatio);
  const reviewCount = maxCards - newCount;

  const queue = [
    ...dueCards.slice(0, reviewCount),
    ...newCards.slice(0, newCount),
  ];

  // Shuffle the queue
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  return queue.slice(0, maxCards);
}
