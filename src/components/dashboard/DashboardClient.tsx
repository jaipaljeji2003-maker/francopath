"use client";

import { Profile, DashboardStats, CEFRLevel } from "@/types";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const LEVELS: CEFRLevel[] = ["A0", "A1", "A2", "B1", "B2"];

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

        {/* AI Coach */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 animate-fade-up-delay">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-brand-accent/10 flex items-center justify-center text-lg">
              🤖
            </div>
            <div>
              <div className="font-bold text-sm">AI Coach</div>
              <div className="text-[10px] text-brand-dim">Personalized insights</div>
            </div>
          </div>
          <div className="space-y-2">
            {stats.accuracy >= 80 ? (
              <p className="text-sm text-brand-muted bg-brand-accent/5 border border-brand-border rounded-lg px-3 py-2">
                🎯 Strong performance! Your retention rate is excellent. Keep pushing to expand vocabulary.
              </p>
            ) : stats.accuracy >= 60 ? (
              <p className="text-sm text-brand-muted bg-brand-accent/5 border border-brand-border rounded-lg px-3 py-2">
                📈 Good progress! Focus on reviewing words you find difficult. The SRS will adapt.
              </p>
            ) : (
              <p className="text-sm text-brand-muted bg-brand-accent/5 border border-brand-border rounded-lg px-3 py-2">
                🔄 Keep reviewing! Consistency beats intensity. Even 5 minutes daily makes a huge difference. ਮਿਹਨਤ ਕਰਦੇ ਰਹੋ!
              </p>
            )}
            <p className="text-sm text-brand-muted bg-brand-accent/5 border border-brand-border rounded-lg px-3 py-2">
              📝 Today: {stats.todayReviewed}/{profile.daily_goal} cards reviewed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
