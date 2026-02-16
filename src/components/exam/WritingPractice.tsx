"use client";

import { useState } from "react";

interface Props {
  examType: string;
  level: string;
}

type Phase = "select" | "loading" | "writing" | "grading" | "results";

export default function WritingPractice({ examType, level }: Props) {
  const [phase, setPhase] = useState<Phase>("select");
  const [taskType, setTaskType] = useState<string>("formal_letter");
  const [task, setTask] = useState<any>(null);
  const [submission, setSubmission] = useState("");
  const [grading, setGrading] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRef, setTimerRef] = useState<NodeJS.Timeout | null>(null);

  const wordCount = submission.trim().split(/\s+/).filter(Boolean).length;

  const generateTask = async (type: string) => {
    setTaskType(type);
    setPhase("loading");
    setError(null);

    try {
      const res = await fetch("/api/exam/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType: type, examType }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setPhase("select");
        return;
      }

      setTask(data.task);
      setSubmission("");
      setGrading(null);
      const limit = (data.task.time_limit_minutes || 30) * 60;
      setTimeLeft(limit);
      setPhase("writing");

      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
      setTimerRef(timer);
    } catch {
      setError("Network error");
      setPhase("select");
    }
  };

  const submitForGrading = async () => {
    if (timerRef) clearInterval(timerRef);
    setPhase("grading");

    try {
      const res = await fetch("/api/exam/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task?.scenario || "", submission, examType }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setPhase("writing");
        return;
      }

      setGrading(data.grading);
      setPhase("results");
    } catch {
      setError("Network error");
      setPhase("writing");
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ─── SELECT ───
  if (phase === "select") {
    return (
      <div className="space-y-4 animate-fade-up">
        <h2 className="text-lg font-bold">Writing Practice</h2>
        <p className="text-brand-muted text-sm">Choose a writing task type. AI will generate a realistic {examType} prompt and grade your response.</p>

        {error && (
          <div className="bg-brand-error/10 border border-brand-error/20 rounded-xl px-4 py-3 text-sm text-brand-error">{error}</div>
        )}

        {[
          { key: "formal_letter", icon: "📧", title: "Formal Letter", desc: "Respond to a job posting, request info, etc." },
          { key: "opinion_essay", icon: "💭", title: "Opinion Essay", desc: "Take a position and argue it" },
          { key: "complaint", icon: "📝", title: "Complaint Letter", desc: "Describe a problem, request resolution" },
          { key: "report", icon: "📊", title: "Report", desc: "Summarize data with recommendations" },
        ].map(t => (
          <button key={t.key} onClick={() => generateTask(t.key)} className="w-full bg-brand-surface border border-brand-border rounded-2xl p-4 text-left hover:border-brand-accent/30 transition-all">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{t.icon}</span>
              <div>
                <div className="font-bold text-sm">{t.title}</div>
                <div className="text-[10px] text-brand-muted">{t.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // ─── LOADING ───
  if (phase === "loading") {
    return (
      <div className="text-center py-16 animate-fade-up">
        <div className="text-5xl mb-4 animate-pulse">✍️</div>
        <p className="text-brand-muted">Generating {examType} writing task...</p>
      </div>
    );
  }

  // ─── WRITING ───
  if (phase === "writing" && task) {
    return (
      <div className="animate-fade-up">
        {/* Timer */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-brand-dim font-semibold">{task.task_title}</span>
          <span className={`text-sm font-mono font-bold ${timeLeft < 120 ? "text-brand-error" : "text-brand-muted"}`}>
            ⏱ {formatTime(timeLeft)}
          </span>
        </div>

        {/* Task prompt */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-4">
          <p className="text-sm text-brand-text leading-relaxed mb-3">{task.scenario}</p>
          {task.scenario_en && <p className="text-xs text-brand-dim italic mb-3">{task.scenario_en}</p>}

          {task.requirements && (
            <div className="mt-3 pt-3 border-t border-brand-border">
              <div className="text-[10px] text-brand-dim font-semibold mb-1">Requirements:</div>
              <div className="space-y-1">
                {task.requirements.map((r: string, i: number) => (
                  <div key={i} className="text-xs text-brand-muted">• {r}</div>
                ))}
              </div>
            </div>
          )}

          {task.useful_expressions && (
            <div className="mt-3 pt-3 border-t border-brand-border">
              <div className="text-[10px] text-brand-dim font-semibold mb-1">Useful expressions:</div>
              <div className="flex flex-wrap gap-1.5">
                {task.useful_expressions.map((e: string, i: number) => (
                  <span key={i} className="text-[10px] bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded-full">{e}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Writing area */}
        <textarea
          value={submission}
          onChange={(e) => setSubmission(e.target.value)}
          placeholder="Écrivez votre réponse ici..."
          className="w-full h-64 px-4 py-3 rounded-2xl border border-brand-border bg-brand-surface text-brand-text text-sm leading-relaxed resize-none focus:border-brand-accent focus:outline-none transition-colors"
        />

        {/* Word count + submit */}
        <div className="flex items-center justify-between mt-3">
          <span className={`text-xs font-mono ${
            wordCount >= (task.word_count_min || 100) ? "text-brand-success" : "text-brand-warning"
          }`}>
            {wordCount} words {task.word_count_min && `(min: ${task.word_count_min})`}
          </span>
          <button
            onClick={submitForGrading}
            disabled={wordCount < 20}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold text-sm disabled:opacity-30 hover:scale-[1.02] transition-transform"
          >
            Submit for Grading
          </button>
        </div>

        {error && (
          <div className="mt-3 bg-brand-error/10 border border-brand-error/20 rounded-xl px-4 py-2 text-xs text-brand-error">{error}</div>
        )}
      </div>
    );
  }

  // ─── GRADING ───
  if (phase === "grading") {
    return (
      <div className="text-center py-16 animate-fade-up">
        <div className="text-5xl mb-4 animate-pulse">🤖</div>
        <p className="text-brand-muted font-semibold">AI is grading your writing...</p>
        <p className="text-brand-dim text-xs mt-2">Checking grammar, coherence, vocabulary, and task completion</p>
      </div>
    );
  }

  // ─── RESULTS ───
  if (phase === "results" && grading) {
    const pct = grading.max_score ? Math.round((grading.overall_score / grading.max_score) * 100) : 0;

    return (
      <div className="space-y-4 animate-fade-up">
        {/* Score */}
        <div className="text-center bg-brand-surface border border-brand-border rounded-2xl p-6">
          <div className="text-5xl mb-2">{pct >= 70 ? "🎉" : pct >= 50 ? "👏" : "💪"}</div>
          <div className="text-4xl font-black text-brand-accent">{grading.overall_score}/{grading.max_score}</div>
          {grading.band && <div className="text-sm text-brand-muted mt-1">Band: {grading.band}</div>}
        </div>

        {/* Criteria */}
        {grading.criteria_scores && (
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-3">Scoring Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(grading.criteria_scores).map(([key, data]: [string, any]) => (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-brand-muted capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-xs font-bold">{data.score}/{data.max}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-brand-border">
                    <div className={`h-full rounded-full ${data.score / data.max >= 0.7 ? "bg-brand-success" : "bg-brand-warning"}`} style={{ width: `${(data.score / data.max) * 100}%` }} />
                  </div>
                  {data.comment && <p className="text-[10px] text-brand-dim mt-1">{data.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errors */}
        {grading.errors && grading.errors.length > 0 && (
          <div className="bg-brand-error/5 border border-brand-error/20 rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-3 text-brand-error">Errors Found</h3>
            <div className="space-y-3">
              {grading.errors.map((err: any, i: number) => (
                <div key={i} className="text-xs">
                  <div className="flex gap-2 items-start">
                    <span className="text-brand-error line-through">{err.original}</span>
                    <span>→</span>
                    <span className="text-brand-success font-semibold">{err.correction}</span>
                  </div>
                  {err.rule && <p className="text-brand-dim mt-0.5 ml-4">Rule: {err.rule}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Improved version */}
        {grading.improved_version && (
          <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-2">✨ Model Answer</h3>
            <p className="text-sm text-brand-muted leading-relaxed whitespace-pre-wrap">{grading.improved_version}</p>
          </div>
        )}

        {/* Tips */}
        {grading.study_tips && (
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-2">📚 Study Tips</h3>
            <div className="space-y-1">
              {grading.study_tips.map((tip: string, i: number) => (
                <p key={i} className="text-xs text-brand-muted">• {tip}</p>
              ))}
            </div>
            {grading.native_language_tip && (
              <div className="mt-3 pt-3 border-t border-brand-border">
                <p className="text-xs text-brand-punjabi">💡 {grading.native_language_tip}</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => { setPhase("writing"); setGrading(null); }} className="flex-1 py-3 rounded-xl bg-brand-accent text-white font-bold text-sm">
            Try Again
          </button>
          <button onClick={() => setPhase("select")} className="flex-1 py-3 rounded-xl border border-brand-border text-sm font-semibold">
            New Task
          </button>
        </div>
      </div>
    );
  }

  return null;
}
