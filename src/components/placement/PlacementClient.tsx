"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import placementQuestions from "@/data/placement-questions.json";
import type { CEFRLevel } from "@/types";

interface Props {
  userId: string;
  userName: string;
}

export default function PlacementClient({ userId, userName }: Props) {
  const [step, setStep] = useState<"onboarding" | "test" | "result">("onboarding");
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [targetExam, setTargetExam] = useState<"TCF" | "TEF">("TCF");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Array<{ selected: number; correct: boolean; time_ms: number }>>([]);
  const [result, setResult] = useState<{ level: CEFRLevel; score: number } | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{ encouragement?: string; strengths?: string[]; weaknesses?: string[]; first_week_focus?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const router = useRouter();
  const supabase = createClient();

  const toggleLang = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleAnswer = async (selected: number) => {
    const q = placementQuestions[currentQ];
    const isCorrect = selected === q.correct_index;
    const timeTaken = Date.now() - startTime;

    const newAnswers = [...answers, { selected, correct: isCorrect, time_ms: timeTaken }];
    setAnswers(newAnswers);

    if (currentQ < placementQuestions.length - 1) {
      setCurrentQ(currentQ + 1);
      setStartTime(Date.now());
    } else {
      // Calculate level
      const score = newAnswers.filter((a) => a.correct).length;
      const pct = (score / placementQuestions.length) * 100;
      let level: CEFRLevel;
      if (pct >= 85) level = "B2";
      else if (pct >= 70) level = "B1";
      else if (pct >= 50) level = "A2";
      else if (pct >= 30) level = "A1";
      else level = "A0";

      setResult({ level, score });
      setStep("result");

      // Fire AI analysis in background
      fetch("/api/ai/placement-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score,
          total: placementQuestions.length,
          answers: newAnswers.map((a, i) => ({ question_index: i, ...a })),
          determinedLevel: level,
        }),
      })
        .then(res => res.json())
        .then(data => { if (data.analysis) setAiAnalysis(data.analysis); })
        .catch(() => {});
    }
  };

  const handleFinishOnboarding = async () => {
    if (!result) return;
    setLoading(true);

    // Update profile
    await supabase
      .from("profiles")
      .update({
        current_level: result.level,
        native_languages: languages,
        preferred_translation: languages.includes("pa") ? "pa" : languages.includes("hi") ? "hi" : "en",
        target_exam: targetExam,
        onboarding_complete: true,
      })
      .eq("id", userId);

    // Save placement result
    await supabase.from("placement_results").insert({
      user_id: userId,
      score: result.score,
      total_questions: placementQuestions.length,
      determined_level: result.level,
      answers: answers.map((a, i) => ({ question_index: i, ...a })),
    });

    // Initialize user cards for their level
    const levels: CEFRLevel[] = ["A0", "A1", "A2", "B1", "B2"];
    const levelIdx = levels.indexOf(result.level);
    const targetLevels = levels.slice(0, levelIdx + 1);

    const { data: words } = await supabase
      .from("words")
      .select("id")
      .in("cefr_level", targetLevels);

    if (words && words.length > 0) {
      const userCards = words.map((w) => ({
        user_id: userId,
        word_id: w.id,
      }));
      // Insert in batches of 50
      for (let i = 0; i < userCards.length; i += 50) {
        await supabase.from("user_cards").insert(userCards.slice(i, i + 50));
      }
    }

    router.push("/dashboard");
  };

  const handleSkipBeginner = async () => {
    setResult({ level: "A0", score: 0 });
    setStep("result");
  };

  // ─── ONBOARDING ───
  if (step === "onboarding") {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="w-full max-w-md animate-fade-up">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🇫🇷</div>
            <h1 className="text-2xl font-extrabold">
              Welcome, {userName || "there"}!
            </h1>
            <p className="text-brand-muted text-sm mt-2">
              Let&apos;s set up your learning path
            </p>
          </div>

          {/* Language selection */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-brand-muted mb-3 block">
              What languages do you speak?
            </label>
            <div className="flex gap-3">
              {[
                { code: "en", label: "English", emoji: "🇬🇧" },
                { code: "pa", label: "ਪੰਜਾਬੀ", emoji: "🇮🇳" },
                { code: "hi", label: "हिन्दी", emoji: "🇮🇳" },
              ].map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => toggleLang(lang.code)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    languages.includes(lang.code)
                      ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                      : "border-brand-border bg-brand-surface text-brand-dim"
                  }`}
                >
                  {lang.emoji} {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exam selection */}
          <div className="mb-8">
            <label className="text-sm font-semibold text-brand-muted mb-3 block">
              Target exam?
            </label>
            <div className="flex gap-3">
              {(["TCF", "TEF"] as const).map((exam) => (
                <button
                  key={exam}
                  onClick={() => setTargetExam(exam)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    targetExam === exam
                      ? "border-brand-gold bg-brand-gold/10 text-brand-gold"
                      : "border-brand-border bg-brand-surface text-brand-dim"
                  }`}
                >
                  🎯 {exam}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setStep("test");
              setStartTime(Date.now());
            }}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold glow-accent hover:scale-[1.02] transition-transform"
          >
            Take Placement Test →
          </button>

          <button
            onClick={handleSkipBeginner}
            className="w-full mt-3 py-3 rounded-xl border border-brand-border text-brand-dim text-sm hover:border-brand-accent/30 transition-colors"
          >
            Skip — I&apos;m a complete beginner (A0)
          </button>
        </div>
      </div>
    );
  }

  // ─── PLACEMENT TEST ───
  if (step === "test") {
    const q = placementQuestions[currentQ];
    const progress = (currentQ / placementQuestions.length) * 100;

    return (
      <div className="min-h-screen bg-brand-bg">
        <div className="max-w-xl mx-auto px-5 py-10">
          {/* Progress */}
          <div className="flex items-center gap-4 mb-10">
            <span className="text-xs text-brand-dim font-semibold">
              {currentQ + 1}/{placementQuestions.length}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-brand-border">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-accent to-purple-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-brand-dim px-2 py-1 rounded-full bg-brand-surface border border-brand-border">
              {q.level}
            </span>
          </div>

          {/* Question */}
          <div key={currentQ} className="animate-fade-up">
            <h2 className="text-xl font-bold mb-8 leading-relaxed">
              {q.question}
            </h2>

            <div className="flex flex-col gap-3">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  className="py-4 px-5 rounded-2xl border border-brand-border bg-brand-surface text-left text-brand-text font-medium hover:border-brand-accent hover:bg-brand-surface-hover hover:translate-x-1 transition-all flex items-center gap-4"
                >
                  <span className="w-7 h-7 rounded-lg bg-brand-accent/10 flex items-center justify-center text-xs font-bold text-brand-accent shrink-0">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULT ───
  if (step === "result" && result) {
    const pct = Math.round((result.score / placementQuestions.length) * 100);
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="text-center max-w-sm animate-scale-in">
          <div className="text-7xl mb-4">
            {pct >= 70 ? "🎉" : pct >= 40 ? "👏" : "🚀"}
          </div>
          <h1 className="text-3xl font-black mb-2">
            Your level: <span className="text-gradient">{result.level}</span>
          </h1>
          <p className="text-brand-muted text-sm mb-2">
            {result.score}/{placementQuestions.length} correct ({pct}%)
          </p>
          <p className="text-brand-dim text-xs mb-8 max-w-xs mx-auto">
            {result.level === "A0" && "Perfect starting point! We'll build your French from the ground up."}
            {result.level === "A1" && "You know the basics! Let's strengthen your foundation."}
            {result.level === "A2" && "Good base! Time to expand your vocabulary and expressions."}
            {result.level === "B1" && "Solid skills! Let's push toward advanced proficiency."}
            {result.level === "B2" && "Impressive! You're ready for advanced content and exam prep."}
          </p>

          {/* AI Analysis */}
          {aiAnalysis && (
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-4 text-left mb-6 animate-fade-up">
              <div className="flex items-center gap-2 mb-3">
                <span>🤖</span>
                <span className="font-bold text-xs">AI Coach Analysis</span>
              </div>
              {aiAnalysis.encouragement && (
                <p className="text-sm text-brand-muted mb-3">{aiAnalysis.encouragement}</p>
              )}
              {aiAnalysis.strengths && aiAnalysis.strengths.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] text-brand-success font-semibold uppercase tracking-wider">Strengths: </span>
                  <span className="text-xs text-brand-muted">{aiAnalysis.strengths.join(", ")}</span>
                </div>
              )}
              {aiAnalysis.weaknesses && aiAnalysis.weaknesses.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] text-brand-warning font-semibold uppercase tracking-wider">To improve: </span>
                  <span className="text-xs text-brand-muted">{aiAnalysis.weaknesses.join(", ")}</span>
                </div>
              )}
              {aiAnalysis.first_week_focus && (
                <div className="bg-brand-accent/5 rounded-lg px-3 py-2 mt-2">
                  <span className="text-[10px] text-brand-accent font-semibold">📌 First week: </span>
                  <span className="text-xs text-brand-muted">{aiAnalysis.first_week_focus}</span>
                </div>
              )}
            </div>
          )}
          {!aiAnalysis && result.score > 0 && (
            <div className="text-xs text-brand-dim mb-6 animate-pulse">🧠 AI is analyzing your results...</div>
          )}

          <button
            onClick={handleFinishOnboarding}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold glow-accent hover:scale-[1.02] transition-transform disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Start Learning →"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
