"use client";

import { useState } from "react";
import Link from "next/link";
import type { Profile } from "@/types";
import DrillRunner from "./DrillRunner";
import WritingPractice from "./WritingPractice";

interface DrillRecord {
  id: string;
  drill_type: string;
  exam_type: string;
  score: number | null;
  max_score: number | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

interface Props {
  profile: Profile;
  isUnlocked: boolean;
  drillHistory: DrillRecord[];
  stats: { accuracy: number; mastered: number; totalCards: number };
}

type Tab = "overview" | "drill" | "writing" | "predict";

export default function ExamPrepClient({ profile, isUnlocked, drillHistory, stats }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [prediction, setPrediction] = useState<any>(null);
  const [predicting, setPredicting] = useState(false);

  const exam = profile.target_exam || "TCF";
  const completedDrills = drillHistory.filter(d => d.completed);
  const avgScore = completedDrills.length > 0
    ? Math.round(completedDrills.reduce((s, d) => s + ((d.score || 0) / (d.max_score || 1)) * 100, 0) / completedDrills.length)
    : 0;

  const handlePredict = async () => {
    setPredicting(true);
    try {
      const res = await fetch("/api/exam/predict", { method: "POST" });
      const data = await res.json();
      if (res.ok) setPrediction(data.prediction);
    } catch { /* ignore */ }
    setPredicting(false);
  };

  // ─── NOT UNLOCKED ───
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="text-7xl mb-4">🔒</div>
          <h1 className="text-2xl font-black mb-2">Exam Prep Locked</h1>
          <p className="text-brand-muted text-sm mb-3">
            Complete your vocabulary journey to B2 level to unlock {exam} exam preparation mode.
          </p>
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-brand-dim">Progress to unlock</span>
              <span className="text-xs font-bold text-brand-accent">{profile.current_level} → B2</span>
            </div>
            <div className="h-2 rounded-full bg-brand-border">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-purple-400" style={{ width: `${Math.min((stats.mastered / Math.max(stats.totalCards, 1)) * 100, 100)}%` }} />
            </div>
            <p className="text-[10px] text-brand-dim mt-2">{stats.mastered}/{stats.totalCards} words mastered · {stats.accuracy}% accuracy</p>
          </div>
          <Link href="/dashboard" className="text-brand-accent text-sm hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // ─── TAB CONTENT ───
  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-brand-dim hover:text-brand-text text-xl">←</Link>
          <div>
            <h1 className="text-2xl font-extrabold">🎓 {exam} Exam Prep</h1>
            <p className="text-brand-dim text-xs">Level: {profile.current_level} · {completedDrills.length} drills completed</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-brand-surface border border-brand-border rounded-xl p-1 mb-6">
          {([
            { key: "overview", label: "Overview", icon: "📊" },
            { key: "drill", label: "Drills", icon: "📝" },
            { key: "writing", label: "Writing", icon: "✍️" },
            { key: "predict", label: "Predict", icon: "🔮" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                tab === t.key
                  ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/20"
                  : "text-brand-dim hover:text-brand-muted"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ─── OVERVIEW TAB ─── */}
        {tab === "overview" && (
          <div className="space-y-4 animate-fade-up">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Drills Done", value: completedDrills.length, color: "text-brand-accent" },
                { label: "Avg Score", value: `${avgScore}%`, color: avgScore >= 70 ? "text-brand-success" : "text-brand-warning" },
                { label: "Accuracy", value: `${stats.accuracy}%`, color: stats.accuracy >= 80 ? "text-brand-success" : "text-brand-warning" },
              ].map(s => (
                <div key={s.label} className="bg-brand-surface border border-brand-border rounded-2xl p-4 text-center">
                  <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-brand-dim">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="space-y-3">
              <button onClick={() => setTab("drill")} className="w-full bg-brand-surface border border-brand-border rounded-2xl p-5 text-left hover:border-brand-accent/30 transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📝</span>
                  <div>
                    <div className="font-bold">Comprehension Drill</div>
                    <div className="text-xs text-brand-muted">Read a passage and answer {exam}-style questions</div>
                  </div>
                </div>
              </button>

              <button onClick={() => setTab("drill")} className="w-full bg-brand-surface border border-brand-border rounded-2xl p-5 text-left hover:border-brand-accent/30 transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🔤</span>
                  <div>
                    <div className="font-bold">Vocabulary Drill</div>
                    <div className="text-xs text-brand-muted">Fill-in-the-blank with exam-level vocabulary</div>
                  </div>
                </div>
              </button>

              <button onClick={() => setTab("writing")} className="w-full bg-brand-surface border border-brand-border rounded-2xl p-5 text-left hover:border-brand-accent/30 transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">✍️</span>
                  <div>
                    <div className="font-bold">Writing Practice</div>
                    <div className="text-xs text-brand-muted">Write essays/letters and get AI grading</div>
                  </div>
                </div>
              </button>

              <button onClick={() => { setTab("predict"); handlePredict(); }} className="w-full bg-gradient-to-r from-brand-gold/10 to-brand-gold/5 border border-brand-gold/20 rounded-2xl p-5 text-left hover:border-brand-gold/40 transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🔮</span>
                  <div>
                    <div className="font-bold text-brand-gold">Score Prediction</div>
                    <div className="text-xs text-brand-muted">AI predicts your {exam} score based on performance</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Recent drills */}
            {completedDrills.length > 0 && (
              <div>
                <h3 className="font-bold text-sm mb-3 text-brand-muted">Recent Drills</h3>
                <div className="space-y-2">
                  {completedDrills.slice(0, 5).map(d => (
                    <div key={d.id} className="flex items-center justify-between bg-brand-surface border border-brand-border rounded-xl px-4 py-3">
                      <div>
                        <span className="text-sm font-semibold">{d.drill_type}</span>
                        <span className="text-[10px] text-brand-dim ml-2">{d.exam_type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${((d.score || 0) / (d.max_score || 1)) >= 0.7 ? "text-brand-success" : "text-brand-warning"}`}>
                          {d.score}/{d.max_score}
                        </span>
                        <span className="text-[10px] text-brand-dim">
                          {d.completed_at ? new Date(d.completed_at).toLocaleDateString() : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── DRILL TAB ─── */}
        {tab === "drill" && <DrillRunner examType={exam} level={profile.current_level} />}

        {/* ─── WRITING TAB ─── */}
        {tab === "writing" && <WritingPractice examType={exam} level={profile.current_level} />}

        {/* ─── PREDICTION TAB ─── */}
        {tab === "predict" && (
          <div className="animate-fade-up">
            {predicting && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4 animate-pulse">🔮</div>
                <p className="text-brand-muted">Analyzing your performance data...</p>
              </div>
            )}

            {!predicting && !prediction && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">🔮</div>
                <h2 className="text-xl font-bold mb-2">Score Prediction</h2>
                <p className="text-brand-muted text-sm mb-6">AI analyzes your drill history, accuracy, and vocabulary mastery to predict your {exam} score.</p>
                <button onClick={handlePredict} className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 text-white font-bold hover:scale-[1.02] transition-transform">
                  Generate Prediction
                </button>
              </div>
            )}

            {prediction && !predicting && (
              <div className="space-y-4">
                {/* Main prediction */}
                <div className="bg-gradient-to-br from-brand-gold/10 to-brand-gold/5 border border-brand-gold/20 rounded-2xl p-6 text-center">
                  <div className="text-[10px] text-brand-gold font-semibold uppercase tracking-wider mb-2">Predicted {exam} Level</div>
                  <div className="text-5xl font-black text-brand-gold mb-1">{prediction.predicted_level}</div>
                  {prediction.predicted_score_range && (
                    <div className="text-sm text-brand-muted">Score range: {prediction.predicted_score_range}</div>
                  )}
                  {prediction.confidence && (
                    <div className="text-xs text-brand-dim mt-1">Confidence: {prediction.confidence}%</div>
                  )}
                </div>

                {/* Section breakdown */}
                {prediction.section_predictions && (
                  <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
                    <h3 className="font-bold text-sm mb-3">Section Breakdown</h3>
                    <div className="space-y-3">
                      {Object.entries(prediction.section_predictions).map(([section, data]: [string, any]) => (
                        <div key={section}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-brand-muted capitalize">{section.replace(/_/g, " ")}</span>
                            <span className="text-xs font-bold text-brand-accent">{data.predicted}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-brand-border">
                            <div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: `${data.readiness_pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Priority actions */}
                {prediction.priority_actions && (
                  <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
                    <h3 className="font-bold text-sm mb-3">🎯 Priority Actions</h3>
                    <div className="space-y-2">
                      {prediction.priority_actions.map((action: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-brand-accent font-bold text-sm">{i + 1}.</span>
                          <span className="text-sm text-brand-muted">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                {prediction.days_to_ready && (
                  <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl p-5 text-center">
                    <div className="text-3xl font-black text-brand-accent">{prediction.days_to_ready} days</div>
                    <div className="text-xs text-brand-muted">estimated to exam readiness</div>
                  </div>
                )}

                {/* Encouragement */}
                {prediction.encouragement && (
                  <div className="bg-brand-success/5 border border-brand-success/20 rounded-2xl p-4">
                    <p className="text-sm text-brand-muted">💪 {prediction.encouragement}</p>
                  </div>
                )}

                <button onClick={handlePredict} className="w-full py-3 rounded-xl border border-brand-border text-sm text-brand-dim hover:border-brand-accent/30 transition-colors">
                  🔄 Regenerate Prediction
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
