"use client";

import { useState } from "react";

interface Props {
  examType: string;
  level: string;
}

type DrillType = "comprehension" | "vocab";
type Phase = "select" | "loading" | "active" | "results";

export default function DrillRunner({ examType, level }: Props) {
  const [drillType, setDrillType] = useState<DrillType>("comprehension");
  const [phase, setPhase] = useState<Phase>("select");
  const [drill, setDrill] = useState<any>(null);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const generateDrill = async (type: DrillType) => {
    setDrillType(type);
    setPhase("loading");
    setError(null);

    try {
      const res = await fetch("/api/exam/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drillType: type, examType, category: "reading" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to generate drill");
        setPhase("select");
        return;
      }

      setDrill(data.drill);
      setDrillId(data.drillId);
      setCurrentQ(0);
      setAnswers([]);
      setShowExplanation(false);
      setTimeLeft(type === "vocab" ? 300 : 600);
      setPhase("active");

      // Start timer
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setError("Network error");
      setPhase("select");
    }
  };

  const handleAnswer = (selectedIndex: number) => {
    const newAnswers = [...answers, selectedIndex];
    setAnswers(newAnswers);
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    const questions = drill?.questions || [];
    if (currentQ < questions.length - 1) {
      setCurrentQ(prev => prev + 1);
      setShowExplanation(false);
    } else {
      setPhase("results");
    }
  };

  const questions = drill?.questions || [];
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ─── SELECT ───
  if (phase === "select") {
    return (
      <div className="space-y-4 animate-fade-up">
        <h2 className="text-lg font-bold">Choose a Drill</h2>

        {error && (
          <div className="bg-brand-error/10 border border-brand-error/20 rounded-xl px-4 py-3 text-sm text-brand-error">
            {error}
          </div>
        )}

        <button onClick={() => generateDrill("comprehension")} className="w-full bg-brand-surface border border-brand-border rounded-2xl p-5 text-left hover:border-brand-accent/30 transition-all">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📖</span>
            <div>
              <div className="font-bold">Reading Comprehension</div>
              <div className="text-xs text-brand-muted">Read a {examType} passage and answer 4 questions · 10 min</div>
            </div>
          </div>
        </button>

        <button onClick={() => generateDrill("vocab")} className="w-full bg-brand-surface border border-brand-border rounded-2xl p-5 text-left hover:border-brand-accent/30 transition-all">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔤</span>
            <div>
              <div className="font-bold">Vocabulary in Context</div>
              <div className="text-xs text-brand-muted">Fill blanks with the correct word · 5 questions · 5 min</div>
            </div>
          </div>
        </button>
      </div>
    );
  }

  // ─── LOADING ───
  if (phase === "loading") {
    return (
      <div className="text-center py-16 animate-fade-up">
        <div className="text-5xl mb-4 animate-pulse">🤖</div>
        <p className="text-brand-muted font-semibold">Generating {examType} {drillType} drill...</p>
        <p className="text-brand-dim text-xs mt-2">AI is creating a realistic exam-style exercise for {level}</p>
      </div>
    );
  }

  // ─── ACTIVE ───
  if (phase === "active" && drill) {
    const q = questions[currentQ];
    if (!q) { setPhase("results"); return null; }

    const isAnswered = answers.length > currentQ;
    const isCorrect = isAnswered && answers[currentQ] === q.correct_index;

    return (
      <div className="animate-fade-up">
        {/* Timer + progress */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-brand-dim">{currentQ + 1}/{questions.length}</span>
          <span className={`text-sm font-mono font-bold ${timeLeft < 60 ? "text-brand-error" : "text-brand-muted"}`}>
            ⏱ {formatTime(timeLeft)}
          </span>
        </div>

        <div className="h-1 rounded-full bg-brand-border mb-6">
          <div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: `${((currentQ + (isAnswered ? 1 : 0)) / questions.length) * 100}%` }} />
        </div>

        {/* Passage (comprehension only) */}
        {drillType === "comprehension" && drill.passage && currentQ === 0 && !isAnswered && (
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-6">
            <div className="text-[10px] text-brand-dim uppercase tracking-wider mb-2 font-semibold">Read the passage</div>
            <p className="text-sm text-brand-text leading-relaxed">{drill.passage}</p>
          </div>
        )}

        {/* For vocab drills, show the sentence */}
        {drillType === "vocab" && q.sentence && (
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-4">
            <p className="text-lg text-brand-text font-medium">{q.sentence}</p>
            {q.sentence_en && <p className="text-xs text-brand-dim mt-2">{q.sentence_en}</p>}
          </div>
        )}

        {/* Question */}
        <div className="mb-4">
          <h3 className="text-base font-bold mb-1">{q.question || "Choose the correct answer:"}</h3>
          {q.question_en && <p className="text-xs text-brand-dim">{q.question_en}</p>}
        </div>

        {/* Options */}
        <div className="space-y-2">
          {(q.options || []).map((opt: string, i: number) => {
            let style = "border-brand-border hover:border-brand-accent/30";
            if (isAnswered) {
              if (i === q.correct_index) style = "border-brand-success bg-brand-success/10";
              else if (i === answers[currentQ]) style = "border-brand-error bg-brand-error/10";
              else style = "border-brand-border opacity-50";
            }

            return (
              <button
                key={i}
                onClick={() => !isAnswered && handleAnswer(i)}
                disabled={isAnswered}
                className={`w-full py-3 px-4 rounded-xl border text-left text-sm font-medium transition-all ${style}`}
              >
                <span className="mr-3 text-brand-accent font-bold">{String.fromCharCode(65 + i)}</span>
                {opt}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showExplanation && q.explanation && (
          <div className="mt-4 animate-fade-up">
            <div className={`rounded-xl px-4 py-3 ${isCorrect ? "bg-brand-success/10 border border-brand-success/20" : "bg-brand-error/10 border border-brand-error/20"}`}>
              <div className="font-bold text-sm mb-1">{isCorrect ? "✅ Correct!" : "❌ Incorrect"}</div>
              <p className="text-xs text-brand-muted">{q.explanation}</p>
            </div>
            <button onClick={nextQuestion} className="w-full mt-3 py-3 rounded-xl bg-brand-accent text-white font-bold text-sm hover:bg-brand-accent/90 transition-colors">
              {currentQ < questions.length - 1 ? "Next Question →" : "See Results"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── RESULTS ───
  if (phase === "results") {
    const correct = answers.filter((a, i) => questions[i] && a === questions[i].correct_index).length;
    const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

    return (
      <div className="text-center animate-scale-in">
        <div className="text-7xl mb-4">{pct >= 75 ? "🎉" : pct >= 50 ? "👏" : "💪"}</div>
        <h2 className="text-3xl font-black mb-1">{correct}/{questions.length}</h2>
        <p className="text-brand-muted text-sm mb-6">{pct}% — {drillType} drill</p>

        {drill.exam_tip && (
          <div className="bg-brand-gold/5 border border-brand-gold/20 rounded-xl px-4 py-3 text-left mb-6">
            <div className="text-[10px] text-brand-gold font-semibold mb-1">💡 Exam Tip</div>
            <p className="text-xs text-brand-muted">{drill.exam_tip}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => generateDrill(drillType)} className="flex-1 py-3 rounded-xl bg-brand-accent text-white font-bold text-sm">
            Another Drill
          </button>
          <button onClick={() => setPhase("select")} className="flex-1 py-3 rounded-xl border border-brand-border text-sm font-semibold">
            Change Type
          </button>
        </div>
      </div>
    );
  }

  return null;
}
