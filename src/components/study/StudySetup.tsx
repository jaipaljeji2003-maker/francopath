"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
}

const WORD_COUNT_OPTIONS = [0, 3, 5, 8, 10, 15];

const DIFFICULTY_OPTIONS = [
  {
    value: "easy" as const,
    label: "Stabilize",
    accent: "High frequency",
    desc: "Useful, reusable words that smooth out recall and reduce overwhelm.",
  },
  {
    value: "medium" as const,
    label: "Exam Core",
    accent: "Best default",
    desc: "Practical words with strong TCF and TEF payoff in comprehension and writing.",
  },
  {
    value: "hard" as const,
    label: "Stretch",
    accent: "Higher leverage",
    desc: "Sharper challenge words with real exam value, not filler easy picks.",
  },
];

function getRecommendation(dueCount: number, availableCount: number): string {
  if (availableCount === 0) return "You have already queued the current study band. Reviews should take priority today.";
  if (dueCount > 20) return "Heavy review load today. Keep new words low so retention stays strong.";
  if (dueCount > 10) return "Moderate review load. A smaller set of new words will give better retention.";
  if (dueCount > 5) return "Balanced day. This is a good time to add a focused batch of new vocabulary.";
  if (dueCount > 0) return "Light review load. You can afford a stronger new-word session.";
  return "No reviews are due, so this is a good day to add fresh vocabulary.";
}

export default function StudySetup({
  userId,
  userLevel,
  targetExam,
  dueCardCount,
  availableNewWordCount,
  defaultNewWords,
  dailyGoal,
}: StudySetupProps) {
  const [newWordCount, setNewWordCount] = useState(
    Math.min(defaultNewWords, availableNewWordCount)
  );
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const recommendation = getRecommendation(dueCardCount, availableNewWordCount);
  const totalSession = dueCardCount + newWordCount;
  const noWordsAvailable = availableNewWordCount === 0;

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
          setError(data.error);
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
      <div className="max-w-xl mx-auto px-5 py-8">
        <div className="flex items-center gap-3 mb-8 animate-fade-up">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-brand-dim hover:text-brand-text text-xl transition-colors"
          >
            {"<"}
          </button>
          <div>
            <h1 className="text-2xl font-extrabold">Study Setup</h1>
            <p className="text-brand-dim text-xs">
              Build an exam-focused session for {targetExam} at {userLevel}.
            </p>
          </div>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-4 animate-fade-up">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-brand-dim uppercase tracking-widest font-semibold mb-1">Reviews Due</div>
              <div className="text-3xl font-black text-brand-warning">{dueCardCount}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-brand-dim uppercase tracking-widest font-semibold mb-1">Available New</div>
              <div className="text-3xl font-black text-brand-accent">{availableNewWordCount}</div>
            </div>
          </div>
        </div>

        <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl px-4 py-3 mb-6 animate-fade-up">
          <div className="text-xs text-brand-muted leading-relaxed">
            {recommendation} AI will choose words for exam value and learner fit instead of just pulling whatever easy seed words remain.
          </div>
        </div>

        {!noWordsAvailable && (
          <div className="mb-6 animate-fade-up">
            <label className="text-sm font-semibold text-brand-muted mb-3 block">
              How many new words should we add?
            </label>
            <div className="grid grid-cols-6 gap-2">
              {WORD_COUNT_OPTIONS.map((count) => {
                const disabled = count > availableNewWordCount && count !== 0;
                return (
                  <button
                    key={count}
                    onClick={() => !disabled && setNewWordCount(count)}
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
                    {count === 0 && <div className="text-[8px] opacity-60">Skip</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {noWordsAvailable && (
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-6 text-center animate-fade-up">
            <p className="text-sm text-brand-muted">
              You have already added the current study band.
            </p>
            <p className="text-xs text-brand-dim mt-1">
              Focus on mastery today, or move your level when you are ready.
            </p>
          </div>
        )}

        {newWordCount > 0 && !noWordsAvailable && (
          <div className="mb-6 animate-fade-up">
            <label className="text-sm font-semibold text-brand-muted mb-3 block">
              What kind of new words should AI target?
            </label>
            <div className="grid grid-cols-1 gap-3">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDifficulty(option.value)}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    difficulty === option.value
                      ? "border-brand-accent bg-brand-accent/10 shadow-lg shadow-brand-accent/5"
                      : "border-brand-border hover:border-brand-accent/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className={`text-sm font-bold ${difficulty === option.value ? "text-brand-accent" : "text-brand-text"}`}>
                        {option.label}
                      </div>
                      <div className="text-[10px] text-brand-dim uppercase tracking-wider mt-1">
                        {option.accent}
                      </div>
                    </div>
                    <div className="text-[10px] text-brand-dim max-w-[220px] text-right">
                      {option.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-brand-surface border border-brand-border rounded-2xl p-4 mb-6 animate-fade-up">
          <div className="flex items-center justify-between text-sm">
            <span className="text-brand-dim">Session preview</span>
            <span className="font-bold text-brand-text">
              {dueCardCount > 0 && <span className="text-brand-warning">{dueCardCount} review</span>}
              {dueCardCount > 0 && newWordCount > 0 && <span className="text-brand-dim"> + </span>}
              {newWordCount > 0 && <span className="text-brand-accent">{newWordCount} new</span>}
              {dueCardCount === 0 && newWordCount === 0 && <span className="text-brand-dim">No cards</span>}
            </span>
          </div>
          {totalSession > dailyGoal && (
            <div className="text-[10px] text-brand-warning mt-1">
              Your session may run past the daily goal of {dailyGoal}, but the queue will stay review-first.
            </div>
          )}
        </div>

        {error && (
          <div className="bg-brand-error/10 border border-brand-error/20 rounded-xl px-4 py-2 mb-4 text-xs text-brand-error">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={loading || totalSession === 0}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold text-lg glow-accent disabled:opacity-50 disabled:cursor-not-allowed transition-opacity mb-3"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">...</span>
              Building a personalized {targetExam} session...
            </span>
          ) : newWordCount > 0 ? (
            <>Start Session - {newWordCount} new + {dueCardCount} review</>
          ) : dueCardCount > 0 ? (
            <>Start Review Session - {dueCardCount} cards</>
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
