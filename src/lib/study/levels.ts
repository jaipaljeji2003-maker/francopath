const LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type StudyLevel = (typeof LEVELS)[number];

export function normalizeStudyLevel(level: string | null | undefined): StudyLevel {
  if (!level) return "A1";
  if ((LEVELS as readonly string[]).includes(level)) return level as StudyLevel;
  return "A1";
}

export function getAdjacentLevel(
  level: string | null | undefined,
  direction: -1 | 1
): StudyLevel | undefined {
  const normalized = normalizeStudyLevel(level);
  const index = LEVELS.indexOf(normalized);
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= LEVELS.length) return undefined;
  return LEVELS[nextIndex];
}

export function getLevelDistance(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftIndex = LEVELS.indexOf(normalizeStudyLevel(left));
  const rightIndex = LEVELS.indexOf(normalizeStudyLevel(right));
  return Math.abs(leftIndex - rightIndex);
}

export function compareStudyLevels(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftIndex = LEVELS.indexOf(normalizeStudyLevel(left));
  const rightIndex = LEVELS.indexOf(normalizeStudyLevel(right));
  return leftIndex - rightIndex;
}
