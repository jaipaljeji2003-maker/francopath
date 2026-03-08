export const STUDY_LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type StudyLevel = (typeof STUDY_LEVELS)[number];

export function normalizeStudyLevel(level: string | null | undefined): StudyLevel {
  if (!level) return "A1";
  if ((STUDY_LEVELS as readonly string[]).includes(level)) return level as StudyLevel;
  return "A1";
}

export function getAdjacentLevel(
  level: string | null | undefined,
  direction: -1 | 1
): StudyLevel | undefined {
  const normalized = normalizeStudyLevel(level);
  const index = STUDY_LEVELS.indexOf(normalized);
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= STUDY_LEVELS.length) return undefined;
  return STUDY_LEVELS[nextIndex];
}

export function getLevelDistance(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftIndex = STUDY_LEVELS.indexOf(normalizeStudyLevel(left));
  const rightIndex = STUDY_LEVELS.indexOf(normalizeStudyLevel(right));
  return Math.abs(leftIndex - rightIndex);
}

export function compareStudyLevels(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftIndex = STUDY_LEVELS.indexOf(normalizeStudyLevel(left));
  const rightIndex = STUDY_LEVELS.indexOf(normalizeStudyLevel(right));
  return leftIndex - rightIndex;
}
