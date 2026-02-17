"use client";

import { useState } from "react";
import Link from "next/link";

export default function PredictionClient({ level, examType }: { level: string; examType: string }) {
  const [prediction, setPrediction] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/exam/predict", { method: "POST" });
      const data = await res.json();
      if (res.ok) { setPrediction(data.prediction); setStats(data.stats); }
      else setError(data.error);
    } catch { setError("Network error"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-brand-dim hover:text-brand-text text-xl">←</Link>
          <div>
            <h1 className="text-2xl font-extrabold">🔮 Score Prediction</h1>
            <p className="text-brand-dim text-xs">{examType} Canada · Honest estimate based on your data</p>
          </div>
        </div>

        {!prediction && !loading && (
          <div className="text-center py-16 animate-fade-up">
            <div className="text-7xl mb-4">🔮</div>
            <h2 className="text-xl font-bold mb-2">Predict your {examType} score</h2>
            <p className="text-brand-muted text-sm mb-2 max-w-sm mx-auto">
              AI analyzes your vocabulary mastery, writing scores, and study patterns.
            </p>
            <p className="text-brand-warning text-xs mb-6">
              ⚠️ Only predicts sections with enough data. Will not fabricate scores.
            </p>
            {error && <div className="bg-brand-error/10 border border-brand-error/20 rounded-xl px-4 py-2 text-xs text-brand-error mb-4">{error}</div>}
            <button onClick={fetchPrediction} className="px-8 py-3 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 text-white font-bold">
              Generate Prediction
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-16 animate-fade-up">
            <div className="text-5xl mb-4 animate-pulse">🔮</div>
            <p className="text-brand-muted">Analyzing your performance data...</p>
          </div>
        )}

        {prediction && !loading && (
          <div className="space-y-4 animate-fade-up">
            {/* Data sufficiency warning */}
            {!prediction.has_enough_data && (
              <div className="bg-brand-warning/10 border border-brand-warning/30 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">⚠️</span>
                  <span className="font-bold text-sm text-brand-warning">Limited Data Available</span>
                </div>
                <p className="text-xs text-brand-muted">Some sections cannot be predicted yet. Keep studying and completing writing tasks to unlock more accurate predictions.</p>
              </div>
            )}

            {/* Overall */}
            {prediction.overall_prediction && prediction.overall_prediction.predicted_level !== "insufficient_data" && (
              <div className="bg-gradient-to-br from-brand-gold/10 to-brand-gold/5 border border-brand-gold/20 rounded-2xl p-6 text-center">
                <div className="text-[10px] text-brand-gold font-semibold uppercase tracking-wider mb-2">Predicted {examType} Level</div>
                <div className="text-5xl font-black text-brand-gold mb-1">{prediction.overall_prediction.predicted_level}</div>
                {prediction.overall_prediction.score_range && <div className="text-sm text-brand-muted">Range: {prediction.overall_prediction.score_range}</div>}
                {prediction.overall_prediction.confidence_pct > 0 && <div className="text-xs text-brand-dim mt-1">Confidence: {prediction.overall_prediction.confidence_pct}%</div>}
              </div>
            )}

            {/* Section breakdown */}
            {prediction.section_predictions && (
              <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-3">Section Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(prediction.section_predictions).map(([section, data]: [string, any]) => (
                    <div key={section}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-brand-muted capitalize">{section.replace(/_/g, " ")}</span>
                        {data.predicted === "insufficient_data" ? (
                          <span className="text-[10px] text-brand-warning bg-brand-warning/10 px-2 py-0.5 rounded-full">Not enough data</span>
                        ) : (
                          <span className="text-xs font-bold text-brand-accent">{data.predicted}</span>
                        )}
                      </div>
                      {data.predicted !== "insufficient_data" && (
                        <div className="h-1.5 rounded-full bg-brand-border">
                          <div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: `${data.readiness_pct}%` }} />
                        </div>
                      )}
                      {data.note && <p className="text-[10px] text-brand-dim mt-0.5">{data.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data needed */}
            {prediction.data_needed?.length > 0 && (
              <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-2">📊 To Improve Predictions</h3>
                {prediction.data_needed.map((item: string, i: number) => (
                  <p key={i} className="text-xs text-brand-muted mb-1">• {item}</p>
                ))}
              </div>
            )}

            {/* Honest assessment */}
            {prediction.honest_assessment && (
              <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-2">📝 Honest Assessment</h3>
                <p className="text-sm text-brand-muted leading-relaxed">{prediction.honest_assessment}</p>
              </div>
            )}

            {/* Your data */}
            {stats && (
              <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-2">📈 Your Data</h3>
                <div className="grid grid-cols-2 gap-2 text-xs text-brand-muted">
                  <div>Vocabulary accuracy: <span className="font-bold text-brand-text">{stats.accuracy}%</span></div>
                  <div>Words mastered: <span className="font-bold text-brand-text">{stats.mastered}/{stats.total}</span></div>
                  <div>Writing submissions: <span className="font-bold text-brand-text">{stats.writingCount}</span></div>
                  <div>Study days: <span className="font-bold text-brand-text">{stats.studyDays}</span></div>
                </div>
              </div>
            )}

            <button onClick={fetchPrediction} className="w-full py-3 rounded-xl border border-brand-border text-sm text-brand-dim hover:border-brand-accent/30 transition-colors">
              🔄 Regenerate Prediction
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
