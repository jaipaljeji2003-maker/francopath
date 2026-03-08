"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DailyMission } from "@/lib/study/daily-mission";
import type { CEFRLevel, DashboardStats, Profile } from "@/types";
import StreakCalendar from "./StreakCalendar";

const LEVELS: CEFRLevel[] = ["A0", "A1", "A2", "B1", "B2"];

const GOAL_OPTIONS = [
  { value: 5, label: "5 cards", desc: "Light load" },
  { value: 10, label: "10 cards", desc: "Balanced" },
  { value: 15, label: "15 cards", desc: "Focused" },
  { value: 20, label: "20 cards", desc: "Intense" },
  { value: 30, label: "30 cards", desc: "Marathon" },
];

function getMissionBadge(mode: DailyMission["mode"]) {
  if (mode === "review-first") return "Review first";
  if (mode === "build") return "Build vocabulary";
  return "Balanced day";
}

export default function DashboardClient({
  profile,
  userId,
  stats,
  mission,
}: {
  profile: Profile;
  userId: string;
  stats: DashboardStats;
  mission: DailyMission;
}) {
  const router = useRouter();
  const supabase = createClient();
  const currentLevelIdx = LEVELS.indexOf(profile.current_level as CEFRLevel);

  const [dailyGoal, setDailyGoal] = useState(profile.daily_goal || 10);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const updateDailyGoal = async (goal: number) => {
    setDailyGoal(goal);
    setShowGoalPicker(false);
    await supabase.from("profiles").update({ daily_goal: goal }).eq("id", userId);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const todayProgress = dailyGoal > 0 ? Math.min(100, Math.round((stats.todayReviewed / dailyGoal) * 100)) : 0;

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <div className="flex justify-between items-start gap-4 mb-8 animate-fade-up">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-brand-dim font-semibold mb-2">
              Daily Mission
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Salut, {profile.name || "Learner"}
            </h1>
            <p className="text-brand-muted text-sm mt-2 max-w-xl">
              FrancoPath should feel like one sharp daily loop: review what matters, add only useful exam vocabulary, and keep momentum honest.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/settings"
              className="px-3 py-2 rounded-xl border border-brand-border text-brand-dim hover:text-brand-text hover:border-brand-accent/30 transition-colors"
            >
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="px-3 py-2 rounded-xl border border-brand-border text-brand-dim hover:text-brand-error hover:border-brand-error/30 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_0.95fr] gap-5 mb-6">
          <div className="bg-brand-surface border border-brand-border rounded-3xl p-6 animate-fade-up">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="text-xs uppercase tracking-[0.18em] text-brand-dim font-semibold">
                Today&apos;s Best Session
              </div>
              <div className="px-3 py-1 rounded-full border border-brand-accent/20 bg-brand-accent/10 text-brand-accent text-xs font-semibold">
                {getMissionBadge(mission.mode)}
              </div>
            </div>

            <h2 className="text-2xl font-black mb-2">{mission.title}</h2>
            <p className="text-sm text-brand-muted leading-relaxed mb-5">
              {mission.summary}
            </p>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-2xl border border-brand-border bg-brand-bg/60 p-4">
                <div className="text-2xl font-extrabold text-brand-warning">{stats.dueCount}</div>
                <div className="text-[11px] text-brand-dim mt-1">Due review</div>
              </div>
              <div className="rounded-2xl border border-brand-border bg-brand-bg/60 p-4">
                <div className="text-2xl font-extrabold text-brand-accent">{mission.recommendedNewWords}</div>
                <div className="text-[11px] text-brand-dim mt-1">Recommended new</div>
              </div>
              <div className="rounded-2xl border border-brand-border bg-brand-bg/60 p-4">
                <div className="text-lg font-extrabold text-brand-text">{mission.levelBandLabel}</div>
                <div className="text-[11px] text-brand-dim mt-1">Study band</div>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-accent/15 bg-brand-accent/5 px-4 py-3 mb-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-brand-accent font-semibold mb-1">
                Why this plan
              </div>
              <div className="text-sm text-brand-muted leading-relaxed">{mission.reason}</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/study"
                className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white text-center font-bold glow-accent"
              >
                {mission.ctaLabel}
              </Link>
              <Link
                href="/study"
                className="sm:w-44 py-4 rounded-2xl border border-brand-border bg-brand-bg/60 text-center font-semibold text-brand-text hover:border-brand-accent/30 transition-colors"
              >
                Tune Session
              </Link>
            </div>
          </div>

          <div className="space-y-5 animate-fade-up-delay">
            <div className="bg-brand-surface border border-brand-border rounded-3xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-brand-dim font-semibold">
                    Today
                  </div>
                  <div className="text-2xl font-black mt-1">
                    {stats.todayReviewed}/{dailyGoal}
                  </div>
                </div>
                <button
                  onClick={() => setShowGoalPicker((value) => !value)}
                  className="text-xs text-brand-accent font-semibold hover:underline"
                >
                  Change goal
                </button>
              </div>
              <div className="h-2 rounded-full bg-brand-border overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-accent to-purple-500 transition-all"
                  style={{ width: `${todayProgress}%` }}
                />
              </div>
              <div className="text-xs text-brand-dim">
                Keep the daily loop small enough to finish consistently.
              </div>

              {showGoalPicker && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {GOAL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateDailyGoal(option.value)}
                      className={`px-3 py-3 rounded-2xl border text-left transition-colors ${
                        dailyGoal === option.value
                          ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                          : "border-brand-border text-brand-dim hover:border-brand-accent/30"
                      }`}
                    >
                      <div className="text-sm font-bold">{option.label}</div>
                      <div className="text-[11px] opacity-70 mt-1">{option.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-brand-surface border border-brand-border rounded-3xl p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-brand-dim font-semibold mb-4">
                Level Path
              </div>
              <div className="flex gap-2 mb-3">
                {LEVELS.map((level, index) => (
                  <div key={level} className="flex-1">
                    <div
                      className={`h-2 rounded-full ${
                        index <= currentLevelIdx
                          ? "bg-gradient-to-r from-brand-accent to-purple-500"
                          : "bg-brand-border"
                      }`}
                    />
                    <div
                      className={`text-[10px] text-center mt-1 font-semibold ${
                        index <= currentLevelIdx ? "text-brand-accent" : "text-brand-dim"
                      }`}
                    >
                      {level}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-brand-dim">
                Current level: <span className="text-brand-text font-semibold">{profile.current_level}</span>
                {" "}toward{" "}
                <span className="text-brand-text font-semibold">{profile.target_exam} Canada</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-fade-up-delay">
          {[
            { label: "Due", value: stats.dueCount, color: "text-brand-warning" },
            { label: "Queued", value: stats.queuedCount, color: "text-brand-accent" },
            { label: "Accuracy", value: `${stats.accuracy}%`, color: stats.accuracy >= 80 ? "text-brand-success" : "text-brand-warning" },
            { label: "Streak", value: stats.streak, color: "text-brand-text" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-brand-surface border border-brand-border rounded-2xl p-4"
            >
              <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
              <div className="text-[11px] text-brand-dim mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-fade-up-delay">
          <Link
            href="/exam-prep"
            className="bg-brand-surface border border-brand-border rounded-3xl p-5 hover:border-brand-accent/30 transition-colors"
          >
            <div className="text-xs uppercase tracking-[0.18em] text-brand-dim font-semibold mb-2">
              Core Tool
            </div>
            <div className="text-lg font-bold mb-1">Writing Practice</div>
            <div className="text-sm text-brand-dim">
              Turn weak vocab and grammar into actual exam writing feedback.
            </div>
          </Link>
          <Link
            href="/words"
            className="bg-brand-surface border border-brand-border rounded-3xl p-5 hover:border-brand-accent/30 transition-colors"
          >
            <div className="text-xs uppercase tracking-[0.18em] text-brand-dim font-semibold mb-2">
              Core Tool
            </div>
            <div className="text-lg font-bold mb-1">Word Bank</div>
            <div className="text-sm text-brand-dim">
              Inspect what is already in your system before adding more.
            </div>
          </Link>
        </div>

        <div className="mb-6 animate-fade-up-delay">
          <StreakCalendar userId={userId} />
        </div>
      </div>
    </div>
  );
}
