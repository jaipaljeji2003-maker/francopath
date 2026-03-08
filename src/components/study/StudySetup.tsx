"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { snapNewWordCount, type DailyMission } from "@/lib/study/daily-mission";
import type { TranslationLang } from "@/types";

interface StudySetupProps {
  userId: string;
  userLevel: string;
  targetExam: string;
  dueCardCount: number;
  availableNewWordCount: number;
  defaultNewWords: number;
  dailyGoal: number;
  preferredLang: TranslationLang;
  mission: DailyMission;
}

const WORD_COUNT_OPTIONS = [0, 3, 5, 8, 10, 15];
const MAX_PREVIEW_COUNT = WORD_COUNT_OPTIONS[WORD_COUNT_OPTIONS.length - 1];

const DIFFICULTY_OPTIONS = [
  {
    value: "easy" as const,
    label: "Stabilize",
    accent: "High frequency",
    desc: "Keep the load useful and reusable when review pressure is already high.",
  },
  {
    value: "medium" as const,
    label: "Exam Core",
    accent: "Best default",
    desc: "Practical vocabulary with strong reading, listening, and writing payoff.",
  },
  {
    value: "hard" as const,
    label: "Stretch",
    accent: "Sharper challenge",
    desc: "Push into harder exam vocabulary without falling into filler easy words.",
  },
];

function getRecommendation(dueCount: number, availableCount: number): string {
  if (availableCount === 0) return "New-word inventory is thin right now, so today should be about retention and review quality.";
  if (dueCount > 20) return "Your queue is heavy. A small new-word batch is enough.";
  if (dueCount > 10) return "You have meaningful review pressure, so stay selective with new additions.";
  if (dueCount > 5) return "This is a good day for a balanced session.";
  if (dueCount > 0) return "Review load is manageable, so you can safely add useful new words.";
  return "No reviews are due, so this is the best time to expand your exam vocabulary.";
}

function getAvailabilityNote(params: {
  availableCount: number;
  preferredAvailableCount: number;
  difficultyLabel: string;
  levels: string[];
  fallbackExpansion: boolean;
}): string {
  if (params.availableCount === 0) {
    return `No strong ${params.difficultyLabel.toLowerCase()} words are available right now. Review-only is the better session.`;
  }

  const levelText = params.levels.length ? ` across ${params.levels.join(", ")}` : "";
  if (params.fallbackExpansion && params.availableCount > params.preferredAvailableCount) {
    return `${params.availableCount} words are available${levelText}. AI may widen slightly beyond the ideal band so the session still feels valuable.`;
  }

  return `${params.availableCount} words are currently available${levelText} for this mode.`;
}

export default function StudySetup({
  userId,
  userLevel,
  targetExam,
  dueCardCount,
  availableNewWordCount,
  dailyGoal,
  mission,
}: StudySetupProps) {
  const [newWordCount, setNewWordCount] = useState(() =>
    snapNewWordCount(mission.recommendedNewWords, availableNewWordCount)
  );
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    mission.recommendedDifficulty
  );
  const [liveAvailableCount, setLiveAvailableCount] = useState(availableNewWordCount);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityNote, setAvailabilityNote] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const refreshAvailability = async () => {
      setAvailabilityLoading(true);

      try {
        const res = await fetch("/api/ai/select-words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: MAX_PREVIEW_COUNT, difficulty, preview: true }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Could not refresh availability.");
        }

        if (cancelled) return;

        const nextAvailableCount =
          typeof data.availableCount === "number" ? data.availableCount : availableNewWordCount;
        const nextPreferredCount =
          typeof data.preferredAvailableCount === "number"
            ? data.preferredAvailableCount
            : nextAvailableCount;
        const difficultyLabel =
          DIFFICULTY_OPTIONS.find((option) => option.value === difficulty)?.label || "Selected";

        setLiveAvailableCount(nextAvailableCount);
        setAvailabilityNote(
          getAvailabilityNote({
            availableCount: nextAvailableCount,
            preferredAvailableCount: nextPreferredCount,
            difficultyLabel,
            levels: Array.isArray(data.levels) ? data.levels : [],
            fallbackExpansion: Boolean(data.fallbackExpansion),
          })
        );
        setNewWordCount((current) => snapNewWordCount(current, nextAvailableCount));
      } catch {
        if (cancelled) return;
        setLiveAvailableCount(availableNewWordCount);
        setAvailabilityNote(
          "Exact availability could not be refreshed, but the session builder will still use the best nearby words it can justify."
        );
        setNewWordCount((current) => snapNewWordCount(current, availableNewWordCount));
      } finally {
        if (!cancelled) {
          setAvailabilityLoading(false);
        }
      }
    };

    refreshAvailability();

    return () => {
      cancelled = true;
    };
  }, [difficulty, availableNewWordCount]);

  const recommendation = getRecommendation(dueCardCount, liveAvailableCount);
  const recommendedNewWordCount = snapNewWordCount(mission.recommendedNewWords, liveAvailableCount);
  const totalSession = dueCardCount + newWordCount;
  const noWordsAvailable = liveAvailableCount === 0;
  const usingRecommended =
    newWordCount === recommendedNewWordCount && difficulty === mission.recommendedDifficulty;

  const resetToRecommended = () => {
    setError(null);
    setDifficulty(mission.recommendedDifficulty);
    setNewWordCount(recommendedNewWordCount);
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      if (newWordCount > 0) {
        const res = await fetch("/api/ai/select-words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: newWordCount, difficulty }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not prepare your study set.");
          setLoading(false);
          return;
        }

        if (data.error && data.selected?.length === 0) {
          const nextAvailableCount =
            typeof data.availableCount === "number" ? data.availableCount : liveAvailableCount;
          setLiveAvailableCount(nextAvailableCount);
          setNewWordCount((current) => snapNewWordCount(current, nextAvailableCount));
          setError(
            nextAvailableCount === 0 && dueCardCount > 0
              ? `${data.error} Your due reviews are still ready below.`
              : data.error
          );
          setLoading(false);
          return;
        }

        window.sessionStorage.setItem(
          "francopath:lastWordSelection",
          JSON.stringify({
            userId,
            count: data.count,
            reasoning: data.reasoning,
            theme: data.theme,
            fallback: data.fallback,
            levels: data.levels,
            strategy: data.strategy,
            targetExam,
          })
        );
      }

      window.location.href = "/study?ready=1";
    } catch {
      setError("Something went wrong while preparing your session. You can still review due cards.");
      setLoading(false);
    }
  };

  const handleSkip = () => {
    window.location.href = "/study?ready=1";
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="flex items-center gap-3 mb-8 animate-fade-up">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-brand-dim hover:text-brand-text text-xl transition-colors"
          >
            {"<"}
          </button>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-brand-dim font-semibold mb-1">
              Study Setup
            </div>
            <h1 className="text-2xl font-extrabold">Recommended daily loop</h1>
            <p className="text-brand-dim text-sm">
              One sharp {targetExam} session for {userLevel}, with review protected first.
            </p>
          </div>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-3xl p-6 mb-5 animate-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="text-xs uppercase tracking-[0.18em] text-brand-dim font-semibold">
              Recommended today
            </div>
            <div className="px-3 py-1 rounded-full border border-brand-accent/20 bg-brand-accent/10 text-brand-accent text-xs font-semibold">
              {usingRecommended ? "Using recommendation" : "Custom session"}
            </div>
          </div>

          <h2 className="text-2xl font-black mb-2">{mission.title}</h2>
          <p className="text-sm text-brand-muted leading-relaxed mb-5">{mission.summary}</p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-2xl border border-brand-border bg-brand-bg/60 p-4">
              <div className="text-2xl font-extrabold text-brand-warning">{dueCardCount}</div>
              <div className="text-[11px] text-brand-dim mt-1">Review due</div>
            </div>
            <div className="rounded-2xl border border-brand-border bg-brand-bg/60 p-4">
              <div className="text-2xl font-extrabold text-brand-accent">
                {availabilityLoading ? "..." : recommendedNewWordCount}
              </div>
              <div className="text-[11px] text-brand-dim mt-1">Recommended new</div>
            </div>
            <div className="rounded-2xl border border-brand-border bg-brand-bg/60 p-4">
              <div className="text-lg font-extrabold text-brand-text">{mission.levelBandLabel}</div>
              <div className="text-[11px] text-brand-dim mt-1">Study band</div>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-accent/15 bg-brand-accent/5 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-brand-accent font-semibold mb-1">
              Why this session
            </div>
            <div className="text-sm text-brand-muted leading-relaxed">{mission.reason}</div>
          </div>
        </div>

        <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl px-4 py-3 mb-5 animate-fade-up">
          <div className="text-sm text-brand-muted leading-relaxed">
            {recommendation}
          </div>
        </div>

        {availabilityNote && (
          <div className="bg-brand-surface border border-brand-border rounded-2xl px-4 py-3 mb-5 animate-fade-up">
            <div className="text-sm text-brand-dim leading-relaxed">{availabilityNote}</div>
          </div>
        )}

        <div className="bg-brand-surface border border-brand-border rounded-3xl p-5 mb-5 animate-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-brand-text">Tune this session</div>
              <div className="text-xs text-brand-dim mt-1">
                Keep the recommendation, or open the controls if you want to adjust count and difficulty.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetToRecommended}
                className="px-3 py-2 rounded-xl border border-brand-border text-sm font-semibold text-brand-dim hover:border-brand-accent/30 hover:text-brand-text transition-colors"
              >
                Use recommended
              </button>
              <button
                onClick={() => setShowAdvanced((value) => !value)}
                className="px-3 py-2 rounded-xl border border-brand-border text-sm font-semibold text-brand-text hover:border-brand-accent/30 transition-colors"
              >
                {showAdvanced ? "Hide controls" : "Adjust session"}
              </button>
            </div>
          </div>

          {showAdvanced && (
            <div className="mt-5 pt-5 border-t border-brand-border">
              {!noWordsAvailable && (
                <div className="mb-6">
                  <label className="text-sm font-semibold text-brand-muted mb-3 block">
                    New words
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {WORD_COUNT_OPTIONS.map((count) => {
                      const disabled = count > liveAvailableCount && count !== 0;
                      return (
                        <button
                          key={count}
                          onClick={() => {
                            if (disabled) return;
                            setError(null);
                            setNewWordCount(count);
                          }}
                          disabled={disabled}
                          className={`py-3 rounded-xl border text-center font-semibold transition-all ${
                            newWordCount === count
                              ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                              : disabled
                                ? "border-brand-border text-brand-border cursor-not-allowed"
                                : "border-brand-border text-brand-dim hover:border-brand-accent/30"
                          }`}
                        >
                          <div className="text-lg">{count}</div>
                          {count === 0 && <div className="text-[9px] opacity-60">Skip</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-brand-muted mb-3 block">
                  Target mode
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setError(null);
                        setDifficulty(option.value);
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        difficulty === option.value
                          ? "border-brand-accent bg-brand-accent/10 shadow-lg shadow-brand-accent/5"
                          : "border-brand-border hover:border-brand-accent/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div
                            className={`text-sm font-bold ${
                              difficulty === option.value ? "text-brand-accent" : "text-brand-text"
                            }`}
                          >
                            {option.label}
                          </div>
                          <div className="text-[10px] text-brand-dim uppercase tracking-wider mt-1">
                            {option.accent}
                          </div>
                        </div>
                        <div className="text-[11px] text-brand-dim max-w-[260px] text-right">
                          {option.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-2xl p-4 mb-5 animate-fade-up">
          <div className="flex items-center justify-between text-sm">
            <span className="text-brand-dim">Session preview</span>
            <span className="font-bold text-brand-text">
              {dueCardCount > 0 && <span className="text-brand-warning">{dueCardCount} review</span>}
              {dueCardCount > 0 && newWordCount > 0 && <span className="text-brand-dim"> + </span>}
              {newWordCount > 0 && <span className="text-brand-accent">{newWordCount} new</span>}
              {dueCardCount === 0 && newWordCount === 0 && <span className="text-brand-dim">No cards</span>}
            </span>
          </div>
          <div className="text-xs text-brand-dim mt-2">
            {usingRecommended
              ? "You are using the recommended daily session."
              : "You have tuned this session away from the default recommendation."}
          </div>
          {totalSession > dailyGoal && (
            <div className="text-[11px] text-brand-warning mt-2">
              This session is larger than your daily goal of {dailyGoal}, so finishing it may take longer than usual.
            </div>
          )}
        </div>

        {error && (
          <div className="bg-brand-error/10 border border-brand-error/20 rounded-xl px-4 py-3 mb-4 text-sm text-brand-error">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={loading || totalSession === 0 || newWordCount > liveAvailableCount}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold text-lg glow-accent disabled:opacity-50 disabled:cursor-not-allowed transition-opacity mb-3"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">...</span>
              Building your {targetExam} session...
            </span>
          ) : newWordCount > 0 ? (
            <>Start session - {newWordCount} new + {dueCardCount} review</>
          ) : dueCardCount > 0 ? (
            <>Start review session - {dueCardCount} cards</>
          ) : (
            "No cards to study"
          )}
        </button>

        {dueCardCount > 0 && (
          <button
            onClick={handleSkip}
            className="w-full py-3 rounded-xl border border-brand-border text-sm text-brand-dim font-semibold hover:border-brand-accent/30 transition-colors"
          >
            Review due cards only
          </button>
        )}
      </div>
    </div>
  );
}
