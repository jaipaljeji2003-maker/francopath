"use client";

import { useState, useEffect } from "react";
import { Profile, DashboardStats, CEFRLevel } from "@/types";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import StreakCalendar from "./StreakCalendar";

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
  userId,
  stats,
}: {
  profile: Profile;
  userId: string;
  stats: DashboardStats;
}) {
  const router = useRouter();
  const supabase = createClient();
  const currentLevelIdx = LEVELS.indexOf(profile.current_level as CEFRLevel);

  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [dailyGoal, setDailyGoal] = useState(profile.daily_goal || 10);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  useEffect(() => {
    if (stats.totalCards > 0) fetchAIAnalysis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAIAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/analyze", { method: "POST" });
      const data = await res.json();
      if (res.ok) setAiAnalysis(data.analysis);
      else setAiError(data.error || "Could not load AI insights");
    } catch { setAiError("Network error"); }
    setAiLoading(false);
  };

  const updateDailyGoal = async (goal: number) => {
    setDailyGoal(goal);
    setShowGoalPicker(false);
    await supabase.from("profiles").update({ daily_goal: goal }).eq("id", userId);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push("/"); };

  const GOAL_OPTIONS = [
    { value: 5, label: "5 cards", desc: "Light · ~3 min", emoji: "🌱" },
    { value: 10, label: "10 cards", desc: "Balanced · ~7 min", emoji: "📚" },
    { value: 15, label: "15 cards", desc: "Focused · ~10 min", emoji: "⚡" },
    { value: 20, label: "20 cards", desc: "Intense · ~15 min", emoji: "🔥" },
    { value: 30, label: "30 cards", desc: "Marathon · ~20 min", emoji: "🏆" },
  ];

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 animate-fade-up">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Salut, {profile.name || "Learner"} 👋</h1>
            <p className="text-brand-muted text-sm mt-1">Let&apos;s conquer {profile.target_exam || "TCF"} Canada</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-brand-dim hover:text-brand-accent transition-colors text-xl">⚙️</Link>
            <button onClick={handleSignOut} className="text-brand-dim hover:text-brand-error transition-colors text-xs">Sign out</button>
          </div>
        </div>

        {/* Level Progress */}
        <div className="bg-brand-accent/10 border border-brand-accent/20 rounded-2xl p-6 mb-6 animate-fade-up">
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="text-xs text-brand-dim uppercase tracking-widest font-semibold">Current Level</div>
              <div className="text-4xl font-black text-brand-accent">{profile.current_level}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-brand-dim uppercase tracking-widest font-semibold">{profile.target_exam || "TCF"} Canada</div>
              <div className="text-4xl font-black text-brand-gold">B2</div>
            </div>
          </div>
          <div className="flex gap-1">
            {LEVELS.map((lvl, i) => (
              <div key={lvl} className="flex-1">
                <div className={`h-2 rounded-full transition-all ${i <= currentLevelIdx ? "bg-gradient-to-r from-brand-accent to-purple-400" : "bg-brand-border"}`} />
                <div className={`text-[10px] text-center mt-1 font-semibold ${i <= currentLevelIdx ? "text-brand-accent" : "text-brand-dim"}`}>{lvl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6 animate-fade-up-delay">
          {[
            { label: "Due", value: stats.dueCount, color: "text-brand-warning", icon: "📋" },
            { label: "New", value: stats.newCount, color: "text-brand-accent", icon: "✨" },
            { label: "Mastered", value: stats.masteredCount, color: "text-brand-success", icon: "🏆" },
            { label: "Accuracy", value: `${stats.accuracy}%`, color: stats.accuracy >= 80 ? "text-brand-success" : "text-brand-warning", icon: "🎯" },
          ].map(stat => (
            <div key={stat.label} className="bg-brand-surface border border-brand-border rounded-2xl p-3 text-center">
              <div className="text-xl mb-1">{stat.icon}</div>
              <div className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-brand-dim font-medium">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Daily goal + Study button */}
        <div className="mb-6 animate-fade-up-delay">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-brand-dim">Today: {stats.todayReviewed}/{dailyGoal} cards</span>
            <button onClick={() => setShowGoalPicker(!showGoalPicker)} className="text-[10px] text-brand-accent hover:underline">
              Change daily goal
            </button>
          </div>

          {showGoalPicker && (
            <div className="grid grid-cols-5 gap-2 mb-3 animate-fade-up">
              {GOAL_OPTIONS.map(g => (
                <button key={g.value} onClick={() => updateDailyGoal(g.value)}
                  className={`py-2 rounded-xl border text-center text-xs font-semibold transition-all ${dailyGoal === g.value ? "border-brand-accent bg-brand-accent/10 text-brand-accent" : "border-brand-border text-brand-dim hover:border-brand-accent/30"}`}>
                  <div className="text-lg mb-0.5">{g.emoji}</div>
                  <div>{g.value}</div>
                  <div className="text-[8px] opacity-60">{g.desc.split("·")[0]}</div>
                </button>
              ))}
            </div>
          )}

          <Link href="/study" className="block w-full py-5 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white text-center font-bold text-lg glow-accent">
            <span className="text-xl mr-2">📖</span>
            Start Study Session
            <span className="ml-3 bg-white/20 px-3 py-0.5 rounded-full text-sm">{dailyGoal} cards</span>
          </Link>
        </div>

        {/* Quick Nav — Writing, Mastery Test, Word Bank, Score Prediction */}
        <div className="grid grid-cols-2 gap-3 mb-6 animate-fade-up-delay">
          <Link href="/exam-prep" className="bg-brand-surface border border-brand-border rounded-2xl p-4 hover:border-brand-accent/30 transition-all flex items-center gap-3">
            <span className="text-2xl">✍️</span>
            <div>
              <div className="font-bold text-sm">Writing Practice</div>
              <div className="text-[10px] text-brand-dim">{profile.target_exam || "TCF"} tasks</div>
            </div>
          </Link>
          <Link href="/verify" className="bg-brand-surface border border-brand-border rounded-2xl p-4 hover:border-brand-accent/30 transition-all flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <div className="font-bold text-sm">Mastery Test</div>
              <div className="text-[10px] text-brand-dim">Verify your words</div>
            </div>
          </Link>
          <Link href="/words" className="bg-brand-surface border border-brand-border rounded-2xl p-4 hover:border-brand-accent/30 transition-all flex items-center gap-3">
            <span className="text-2xl">📚</span>
            <div>
              <div className="font-bold text-sm">Word Bank</div>
              <div className="text-[10px] text-brand-dim">Your vocabulary</div>
            </div>
          </Link>
          <Link href="/predict" className="bg-brand-surface border border-brand-border rounded-2xl p-4 hover:border-brand-accent/30 transition-all flex items-center gap-3">
            <span className="text-2xl">🔮</span>
            <div>
              <div className="font-bold text-sm">Score Prediction</div>
              <div className="text-[10px] text-brand-dim">Honest estimate</div>
            </div>
          </Link>
        </div>

        {/* Streak Calendar */}
        <div className="mb-6 animate-fade-up-delay">
          <StreakCalendar userId={userId} />
        </div>

        {/* AI Coach */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 animate-fade-up-delay">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-accent/10 flex items-center justify-center text-lg">🤖</div>
              <div>
                <div className="font-bold text-sm">AI Coach</div>
                <div className="text-[10px] text-brand-dim">Powered by Claude</div>
              </div>
            </div>
            {!aiLoading && (
              <button onClick={fetchAIAnalysis} className="text-[10px] text-brand-dim hover:text-brand-accent transition-colors">🔄</button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between bg-brand-accent/5 border border-brand-border rounded-lg px-3 py-2">
              <span className="text-sm text-brand-muted">📝 Today: {stats.todayReviewed}/{dailyGoal} cards</span>
              <div className="w-20 h-1.5 rounded-full bg-brand-border">
                <div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: `${Math.min((stats.todayReviewed / dailyGoal) * 100, 100)}%` }} />
              </div>
            </div>

            {aiLoading && <div className="bg-brand-accent/5 border border-brand-border rounded-lg px-3 py-3 text-center"><div className="text-sm text-brand-muted animate-pulse">🧠 Analyzing...</div></div>}
            {aiError && !aiLoading && <div className="bg-brand-error/5 border border-brand-error/20 rounded-lg px-3 py-2 text-xs text-brand-error">{aiError}</div>}

            {aiAnalysis && !aiLoading && (
              <>
                <div className="bg-brand-accent/5 border border-brand-border rounded-lg px-3 py-2">
                  <p className="text-sm text-brand-muted leading-relaxed">{aiAnalysis.summary}</p>
                </div>
                {aiAnalysis.focus_areas?.length > 0 && (
                  <div className="bg-brand-warning/5 border border-brand-warning/20 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-brand-warning font-semibold mb-1 uppercase tracking-wider">Focus Areas</div>
                    <div className="flex flex-wrap gap-1.5">
                      {aiAnalysis.focus_areas.map((area, i) => (
                        <span key={i} className="text-xs bg-brand-warning/10 text-brand-warning px-2 py-0.5 rounded-full">{area}</span>
                      ))}
                    </div>
                  </div>
                )}
                {aiAnalysis.motivation && (
                  <div className="bg-brand-success/5 border border-brand-success/20 rounded-lg px-3 py-2">
                    <p className="text-sm text-brand-muted leading-relaxed">💪 {aiAnalysis.motivation}</p>
                  </div>
                )}
              </>
            )}

            {!aiAnalysis && !aiLoading && !aiError && (
              <div className="bg-brand-accent/5 border border-brand-border rounded-lg px-3 py-2">
                <p className="text-sm text-brand-muted">
                  {stats.accuracy >= 80 ? "🎯 Strong performance! Keep expanding vocabulary." : "🔄 Consistency beats intensity. Even 5 minutes daily helps! ਮਿਹਨਤ ਕਰਦੇ ਰਹੋ!"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
