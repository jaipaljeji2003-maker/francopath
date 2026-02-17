"use client";

import { useState } from "react";
import Link from "next/link";

interface Question {
  word_tested: string;
  sentence: string;
  sentence_en: string;
  options: string[];
  correct_index: number;
  explanation: string;
  card_id?: string;
  word_id?: string;
}

export default function MasteryTestClient({ level, examType }: { level: string; examType: string }) {
  const [phase, setPhase] = useState<"idle" | "loading" | "testing" | "submitting" | "results">("idle");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Array<{ selected: number; correct: boolean }>>([]);
  const [results, setResults] = useState<{ demoted: number; confirmed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startTest = async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch("/api/exam/verify", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setPhase("idle"); return; }
      setQuestions(data.test.questions || []);
      setAnswers([]);
      setCurrentQ(0);
      setPhase("testing");
    } catch { setError("Network error"); setPhase("idle"); }
  };

  const handleAnswer = (selected: number) => {
    const q = questions[currentQ];
    const correct = selected === q.correct_index;
    const newAnswers = [...answers, { selected, correct }];
    setAnswers(newAnswers);

    if (currentQ < questions.length - 1) {
      setTimeout(() => setCurrentQ(prev => prev + 1), 800);
    } else {
      submitResults(newAnswers);
    }
  };

  const submitResults = async (finalAnswers: typeof answers) => {
    setPhase("submitting");
    const resultPayload = finalAnswers.map((a, i) => ({
      card_id: questions[i]?.card_id,
      passed: a.correct,
    }));

    try {
      const res = await fetch("/api/exam/verify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: resultPayload }),
      });
      const data = await res.json();
      setResults(data);
      setPhase("results");
    } catch {
      setResults({ demoted: 0, confirmed: finalAnswers.filter(a => a.correct).length });
      setPhase("results");
    }
  };

  // ─── IDLE ───
  if (phase === "idle") {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="max-w-sm text-center animate-fade-up">
          <div className="text-7xl mb-4">✅</div>
          <h1 className="text-2xl font-black mb-2">Mastery Verification</h1>
          <p className="text-brand-muted text-sm mb-6">
            Test if you truly know your &quot;mastered&quot; words in context. Words you fail will be sent back for more practice.
          </p>
          {error && <div className="bg-brand-error/10 border border-brand-error/20 rounded-xl px-4 py-2 text-xs text-brand-error mb-4">{error}</div>}
          <button onClick={startTest} className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold text-lg">
            Start Verification Test
          </button>
          <Link href="/dashboard" className="block mt-4 text-brand-accent text-sm hover:underline">← Dashboard</Link>
        </div>
      </div>
    );
  }

  // ─── LOADING ───
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center animate-fade-up">
          <div className="text-5xl mb-4 animate-pulse">🧠</div>
          <p className="text-brand-muted">Generating verification questions...</p>
        </div>
      </div>
    );
  }

  // ─── TESTING ───
  if (phase === "testing" && questions.length > 0) {
    const q = questions[currentQ];
    const answered = answers.length > currentQ;
    const lastAnswer = answered ? answers[currentQ] : null;

    return (
      <div className="min-h-screen bg-brand-bg">
        <div className="max-w-xl mx-auto px-5 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/dashboard" className="text-brand-dim hover:text-brand-text text-xl">←</Link>
            <div className="flex-1 h-1.5 rounded-full bg-brand-border">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-purple-400 transition-all duration-500" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
            </div>
            <span className="text-xs text-brand-dim font-semibold">{currentQ + 1}/{questions.length}</span>
          </div>

          <div className="animate-fade-up">
            <div className="mb-2">
              <span className="text-[10px] px-3 py-1 rounded-full bg-brand-accent/10 text-brand-accent font-semibold">Testing: {q.word_tested}</span>
            </div>
            <h2 className="text-lg font-bold mb-2 leading-relaxed">{q.sentence}</h2>
            <p className="text-xs text-brand-dim italic mb-6">{q.sentence_en}</p>

            <div className="flex flex-col gap-3">
              {q.options.map((opt, i) => {
                let style = "border-brand-border bg-brand-surface hover:border-brand-accent";
                if (lastAnswer) {
                  if (i === q.correct_index) style = "border-brand-success bg-brand-success/10 text-brand-success";
                  else if (i === lastAnswer.selected && !lastAnswer.correct) style = "border-brand-error bg-brand-error/10 text-brand-error";
                  else style = "border-brand-border bg-brand-surface opacity-50";
                }
                return (
                  <button key={i} onClick={() => !answered && handleAnswer(i)} disabled={answered}
                    className={`py-4 px-5 rounded-2xl border text-left font-medium flex items-center gap-4 transition-all ${style}`}>
                    <span className="w-7 h-7 rounded-lg bg-brand-accent/10 flex items-center justify-center text-xs font-bold text-brand-accent shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {lastAnswer && (
              <div className={`mt-4 px-4 py-3 rounded-xl text-sm ${lastAnswer.correct ? "bg-brand-success/10 border border-brand-success/20 text-brand-muted" : "bg-brand-error/10 border border-brand-error/20 text-brand-muted"}`}>
                {lastAnswer.correct ? "✅ " : "❌ "}{q.explanation}
                {!lastAnswer.correct && <p className="text-xs text-brand-error mt-1 font-semibold">This word will be sent back for more practice.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── SUBMITTING ───
  if (phase === "submitting") {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center animate-pulse"><div className="text-5xl mb-4">⚡</div><p className="text-brand-muted">Processing results...</p></div>
      </div>
    );
  }

  // ─── RESULTS ───
  if (phase === "results" && results) {
    const total = results.confirmed + results.demoted;
    const pct = total > 0 ? Math.round((results.confirmed / total) * 100) : 0;
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="max-w-sm w-full text-center animate-scale-in">
          <div className="text-7xl mb-4">{pct >= 80 ? "🎉" : pct >= 50 ? "👏" : "💪"}</div>
          <h1 className="text-3xl font-black mb-1">{pct >= 80 ? "Verified!" : pct >= 50 ? "Getting there!" : "Keep practicing!"}</h1>

          <div className="grid grid-cols-2 gap-3 my-8">
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-4">
              <div className="text-2xl font-extrabold text-brand-success">{results.confirmed}</div>
              <div className="text-[10px] text-brand-dim">Confirmed ✅</div>
            </div>
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-4">
              <div className="text-2xl font-extrabold text-brand-error">{results.demoted}</div>
              <div className="text-[10px] text-brand-dim">Sent back 🔄</div>
            </div>
          </div>

          {results.demoted > 0 && (
            <p className="text-sm text-brand-muted mb-6">
              {results.demoted} word{results.demoted > 1 ? "s were" : " was"} sent back to your review queue. They&apos;ll appear more frequently until you truly know them.
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={startTest} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold text-sm">Test Again</button>
            <Link href="/dashboard" className="flex-1 py-3.5 rounded-xl border border-brand-border bg-brand-surface text-sm font-semibold text-center">Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
