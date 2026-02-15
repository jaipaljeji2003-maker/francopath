"use client";

import { useState, useEffect } from "react";
import { Profile, DashboardStats, CEFRLevel } from "@/types";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const LEVELS: CEFRLevel[] = ["A0", "A1", "A2", "B1", "B2"];

interface AIAnalysis {
  summary: string;
  can_advance: boolean;
  advance_reason: string;
  focus_areas: string[];
  tcf_tip: string;
  motivation: string;
  predicted_readiness_pct: number;
  weekly_goal: string;
}

export default function DashboardClient({
  profile,
  stats,
}: {
  profile: Profile;
  stats: DashboardStats;
}) {
  const router = useRouter();
  const supabase = createClient();
  const currentLevelIdx = LEVELS.indexOf(profile.current_level as CEFRLevel);

  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Fetch AI analysis on mount (if user has enough data)
  useEffect(() => {
    if (stats.totalCards > 0 && stats.todayReviewed >= 0) {
      fetchAIAnalysis();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAIAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/analyze", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setAiAnalysis(data.analysis);
      } else {
        setAiError(data.error || "Could not load AI insights");
      }
    } catch {
      setAiError("Network error");
    }
    setAiLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 animate-fade-up">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Salut, {profile.name || "Learner"} 👋
            </h1>
            <p className="text-brand-muted text-sm mt-1">
              Let&apos;s conquer French today
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="text-brand-dim hover:text-brand-accent transition-colors text-xl"
            >
              ⚙️
            </Link>
            <button
              onClick={handleSignOut}
              className="text-brand-dim hover:text-brand-error transition-colors text-xs"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Level Progress */}
        <div className="bg-brand-accent/10 border border-brand-accent/20 rounded-2xl p-6 mb-6 animate-fade-up">
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="text-xs text-brand-dim uppercase tracking-widest font-semibold">
                Current Level
              </div>
              <div className="text-4xl font-black text-brand-accent">
                {profile.current_level}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-brand-dim uppercase tracking-widest font-semibold">
                Target
              </div>
              <div className="text-4xl font-black text-brand-gold">B2</div>
            </div>
          </div>
          <div className="flex gap-1">
            {LEVELS.map((lvl, i) => (
              <div key={lvl} className="flex-1">
                <div
                  className={`h-2 rounded-full transition-all ${
                    i <= currentLevelIdx
                      ? "bg-gradient-to-r from-brand-accent to-purple-400"
                      : "bg-brand-border"
                  }`}
                />
                <div
                  className={`text-[10px] text-center mt-1 font-semibold ${
                    i <= currentLevelIdx ? "text-brand-accent" : "text-brand-dim"
                  }`}
                >
                  {lvl}
                </div>
              </div>
            ))}
          </div>

          {profile.exam_prep_unlocked && (
            <Link
              href="/exam-prep"
              className="mt-4 block w-full py-3 rounded-xl bg-brand-gold/20 border border-brand-gold/30 text-brand-gold text-center text-sm font-bold hover:bg-brand-gold/30 transition-colors"
            >
              🎓 TCF/TEF Exam Prep Unlocked →
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6 animate-fade-up-delay">
          {[
            { label: "Due", value: stats.dueCount, color: "text-brand-warning", icon: "📋" },
            { label: "New", value: stats.newCount, color: "text-brand-accent", icon: "✨" },
            { label: "Mastered", value: stats.masteredCount, color: "text-brand-success", icon: "🏆" },
            {
              label: "Accuracy",
              value: `${stats.accuracy}%`,
              color: stats.accuracy >= 80 ? "text-brand-success" : "text-brand-warning",
              icon: "🎯",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-brand-surface border border-brand-border rounded-2xl p-3 text-center"
            >
              <div className="text-xl mb-1">{stat.icon}</div>
              <div className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-brand-dim font-medium">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Study Button */}
        <Link
          href="/study"
          className="block w-full py-5 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white text-center font-bold text-lg glow-accent animate-pulse-soft mb-6"
        >
          <span className="text-xl mr-2">📖</span>
          Start Study Session
          <span className="ml-3 bg-white/20 px-3 py-0.5 rounded-full text-sm">
            {Math.min(stats.dueCount + 4, 10)} cards
          </span>
        </Link>

        {/* AI Coach — POWERED BY CLAUDE */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 animate-fade-up-delay">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-accent/10 flex items-center justify-center text-lg">
                🤖
              </div>
              <div>
                <div className="font-bold text-sm">AI Coach</div>
                <div className="text-[10px] text-brand-dim">Powered by Claude</div>
              </div>
            </div>
            {!aiLoading && (
              <button
                onClick={fetchAIAnalysis}
                className="text-[10px] text-brand-dim hover:text-brand-accent transition-colors"
                title="Refresh analysis"
              >
                🔄 Refresh
              </button>
            )}
          </div>

          <div className="space-y-2">
            {/* Today's progress */}
            <div className="flex items-center justify-between bg-brand-accent/5 border border-brand-border rounded-lg px-3 py-2">
              <span className="text-sm text-brand-muted">
                📝 Today: {stats.todayReviewed}/{profile.daily_goal} cards
              </span>
              <div className="w-20 h-1.5 rounded-full bg-brand-border">
                <div
                  className="h-full rounded-full bg-brand-accent transition-all"
                  style={{ width: `${Math.min((stats.todayReviewed / (profile.daily_goal || 10)) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* AI Loading state */}
            {aiLoading && (
              <div className="bg-brand-accent/5 border border-brand-border rounded-lg px-3 py-3 text-center">
                <div className="text-sm text-brand-muted animate-pulse">
                  🧠 Analyzing your progress...
                </div>
              </div>
            )}

            {/* AI Error state */}
            {aiError && !aiLoading && (
              <div className="bg-brand-error/5 border border-brand-error/20 rounded-lg px-3 py-2 text-xs text-brand-error">
                {aiError.includes("daily_limit") 
                  ? "📊 Analysis limit reached today. Add your API key in Settings for unlimited insights!"
                  : `Could not load insights. ${aiError}`}
              </div>
            )}

            {/* AI Analysis — Real Claude insights */}
            {aiAnalysis && !aiLoading && (
              <>
                {/* Summary */}
                <div className="bg-brand-accent/5 border border-brand-border rounded-lg px-3 py-2">
                  <p className="text-sm text-brand-muted leading-relaxed">
                    {aiAnalysis.summary}
                  </p>
                </div>

                {/* Focus Areas */}
                {aiAnalysis.focus_areas && aiAnalysis.focus_areas.length > 0 && (
                  <div className="bg-brand-warning/5 border border-brand-warning/20 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-brand-warning font-semibold mb-1 uppercase tracking-wider">
                      Focus Areas
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {aiAnalysis.focus_areas.map((area, i) => (
                        <span
                          key={i}
                          className="text-xs bg-brand-warning/10 text-brand-warning px-2 py-0.5 rounded-full"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* TCF/TEF Tip */}
                {aiAnalysis.tcf_tip && (
                  <div className="bg-brand-gold/5 border border-brand-gold/20 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-brand-gold font-semibold mb-1 uppercase tracking-wider">
                      🎯 {profile.target_exam || "TCF"} Tip
                    </div>
                    <p className="text-xs text-brand-muted">{aiAnalysis.tcf_tip}</p>
                  </div>
                )}

                {/* Motivation */}
                {aiAnalysis.motivation && (
                  <div className="bg-brand-success/5 border border-brand-success/20 rounded-lg px-3 py-2">
                    <p className="text-sm text-brand-muted leading-relaxed">
                      💪 {aiAnalysis.motivation}
                    </p>
                  </div>
                )}

                {/* Weekly Goal */}
                {aiAnalysis.weekly_goal && (
                  <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-brand-accent font-semibold mb-1 uppercase tracking-wider">
                      This Week&apos;s Goal
                    </div>
                    <p className="text-xs text-brand-muted">{aiAnalysis.weekly_goal}</p>
                  </div>
                )}

                {/* Readiness */}
                {aiAnalysis.predicted_readiness_pct > 0 && (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-[10px] text-brand-dim">TCF Readiness:</span>
                    <div className="flex-1 h-1.5 rounded-full bg-brand-border">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-success transition-all"
                        style={{ width: `${aiAnalysis.predicted_readiness_pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-brand-accent font-bold">
                      {aiAnalysis.predicted_readiness_pct}%
                    </span>
                  </div>
                )}

                {/* Level advance suggestion */}
                {aiAnalysis.can_advance && (
                  <div className="bg-brand-success/10 border border-brand-success/30 rounded-lg px-3 py-3 text-center">
                    <div className="text-sm font-bold text-brand-success mb-1">
                      🎉 Ready to advance!
                    </div>
                    <p className="text-xs text-brand-muted">{aiAnalysis.advance_reason}</p>
                  </div>
                )}
              </>
            )}

            {/* Fallback when no AI analysis and not loading */}
            {!aiAnalysis && !aiLoading && !aiError && (
              <div className="bg-brand-accent/5 border border-brand-border rounded-lg px-3 py-2">
                <p className="text-sm text-brand-muted">
                  {stats.accuracy >= 80
                    ? "🎯 Strong performance! Keep pushing to expand vocabulary."
                    : stats.accuracy >= 60
                    ? "📈 Good progress! The SRS will adapt to your pace."
                    : "🔄 Consistency beats intensity. Even 5 minutes daily helps! ਮਿਹਨਤ ਕਰਦੇ ਰਹੋ!"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
