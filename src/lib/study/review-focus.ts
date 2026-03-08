export interface WritingFocusSignals {
  weaknessLabels: string[];
  vocabToReview: string[];
}

export function extractWritingFocusSignals(drills: Array<{ ai_grading: any }> | null): WritingFocusSignals {
  const weaknessCounts = new Map<string, number>();
  const vocabCounts = new Map<string, number>();

  for (const drill of drills || []) {
    const grading = drill.ai_grading;
    if (!grading || typeof grading !== "object") continue;

    if (grading.criteria_scores && typeof grading.criteria_scores === "object") {
      for (const [criterion, value] of Object.entries(grading.criteria_scores)) {
        const score =
          typeof value === "object" && value && "score" in value
            ? Number((value as { score?: number | string }).score)
            : NaN;

        if (Number.isFinite(score) && score <= 2) {
          const label = criterion.replace(/_/g, " ").trim();
          weaknessCounts.set(label, (weaknessCounts.get(label) || 0) + 2);
        }
      }
    }

    if (Array.isArray(grading.errors)) {
      for (const error of grading.errors) {
        const label =
          (typeof error?.category === "string" && error.category.trim()) ||
          (typeof error?.rule === "string" && error.rule.trim()) ||
          null;

        if (label) {
          weaknessCounts.set(label, (weaknessCounts.get(label) || 0) + 1);
        }
      }
    }

    if (Array.isArray(grading.vocab_to_review)) {
      for (const item of grading.vocab_to_review) {
        if (typeof item === "string" && item.trim()) {
          const normalized = item.trim().toLowerCase();
          vocabCounts.set(normalized, (vocabCounts.get(normalized) || 0) + 1);
        }
      }
    }
  }

  return {
    weaknessLabels: Array.from(weaknessCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([label]) => label),
    vocabToReview: Array.from(vocabCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([word]) => word),
  };
}
