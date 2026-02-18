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
  { value: "easy" as const, label: "Easy", emoji: "🌱", desc: "Common, high-frequency words" },
  { value: "medium" as const, label: "Medium", emoji: "📚", desc: "Balanced, practical vocabulary" },
  { value: "hard" as const, label: "Hard", emoji: "🔥", desc: "Rarer, exam-focused words" },
];

function getRecommendation(dueCount: number, availableCount: number): string {
  if (availableCount === 0) return "You've added all available words at your level. Focus on reviews!";
  if (dueCount > 20) return "Heavy review load today — consider skipping new words or adding only 3.";
  if (dueCount > 10) return "Moderate review load. 3–5 new words recommended.";
  if (dueCount > 5) return "Light review load. Great time to learn 5–8 new words!";
  if (dueCount > 0) return "Very light load — perfect day to learn 8–10 new words.";
  return "No reviews due! Great time to build your vocabulary with new words.";
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
        if (data.error && data.selected?.length === 0) {
          setError(data.error);
          setLoading(false);
          return;
        }
      }

      // Navigate to the actual study session
      window.location.href = "/study?ready=1";
    } catch {
      setError("Something went wrong. Try again or skip new words.");
      setLoading(false);
    }
  };

  const handleSkip = () => {
    window.location.href = "/study?ready=1";
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 animate-fade-up">
          <button onClick={() => router.push("/dashboard")} className="text-brand-dim hover:text-brand-text text-xl transition-colors">←</button>
          <div>
            <h1 className="text-2xl font-extrabold">Study Setup</h1>
            <p className="text-brand-dim text-xs">Configure today&apos;s session · {userLevel}</p>
          </div>
        </div>

        {/* Review load summary */}
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

        {/* AI recommendation */}
        <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl px-4 py-3 mb-6 animate-fade-up">
          <div className="flex items-center gap-2">
            <span className="text-sm">🤖</span>
            <span className="text-xs text-brand-muted">{recommendation}</span>
          </div>
        </div>

        {/* New words picker */}
        {!noWordsAvailable && (
          <div className="mb-6 animate-fade-up">
            <label className="text-sm font-semibold text-brand-muted mb-3 block">
              How many new words to add?
            </label>
            <div className="grid grid-cols-6 gap-2">
              {WORD_COUNT_OPTIONS.map(n => {
                const disabled = n > availableNewWordCount && n !== 0;
                return (
                  <button
                    key={n}
                    onClick={() => !disabled && setNewWordCount(n)}
                    disabled={disabled}
                    className={`py-3 rounded-xl border text-center font-semibold transition-all ${
                      newWordCount === n
                        ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                        : disabled
                        ? "border-brand-border text-brand-border cursor-not-allowed"
                        : "border-brand-border text-brand-dim hover:border-brand-accent/30"
                    }`}
                  >
                    <div className="text-lg">{n}</div>
                    {n === 0 && <div className="text-[8px] opacity-60">Skip</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* No words available state */}
        {noWordsAvailable && (
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-6 text-center animate-fade-up">
            <div className="text-3xl mb-2">📚</div>
            <p className="text-sm text-brand-muted">You&apos;ve added all available words at <span className="font-bold text-brand-accent">{userLevel}</span>!</p>
            <p className="text-xs text-brand-dim mt-1">Focus on mastering your current vocabulary, or change your level in Settings.</p>
          </div>
        )}

        {/* Difficulty selector */}
        {newWordCount > 0 && !noWordsAvailable && (
          <div className="mb-6 animate-fade-up">
            <label className="text-sm font-semibold text-brand-muted mb-3 block">
              Word difficulty
            </label>
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDifficulty(opt.value)}
                  className={`py-4 rounded-2xl border text-center transition-all ${
                    difficulty === opt.value
                      ? "border-brand-accent bg-brand-accent/10 shadow-lg shadow-brand-accent/5"
                      : "border-brand-border hover:border-brand-accent/30"
                  }`}
                >
                  <div className="text-2xl mb-1">{opt.emoji}</div>
                  <div className={`text-sm font-bold ${difficulty === opt.value ? "text-brand-accent" : "text-brand-text"}`}>
                    {opt.label}
                  </div>
                  <div className="text-[10px] text-brand-dim mt-0.5 px-2">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Session summary */}
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
              Session exceeds daily goal of {dailyGoal} — will be capped
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-brand-error/10 border border-brand-error/20 rounded-xl px-4 py-2 mb-4 text-xs text-brand-error">
            {error}
          </div>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={loading || (totalSession === 0)}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold text-lg glow-accent disabled:opacity-50 disabled:cursor-not-allowed transition-opacity mb-3"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">🤖</span>
              AI is picking your words...
            </span>
          ) : newWordCount > 0 ? (
            <>Start Session — {newWordCount} new + {dueCardCount} review</>
          ) : dueCardCount > 0 ? (
            <>Start Review Session — {dueCardCount} cards</>
          ) : (
            "No cards to study"
          )}
        </button>

        {/* Skip link */}
        {dueCardCount > 0 && (
          <button
            onClick={handleSkip}
            className="w-full py-3 rounded-xl border border-brand-border text-sm text-brand-dim font-semibold hover:border-brand-accent/30 transition-colors"
          >
            Skip setup — just review due cards
          </button>
        )}
      </div>
    </div>
  );
}
