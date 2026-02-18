"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import staticQuestions from "@/data/placement-questions.json";
import type { CEFRLevel } from "@/types";

interface PlacementQuestion {
  question: string;
  options: string[];
  correct_index: number;
  level: string;
  skill_tested?: string;
}

interface Props {
  userId: string;
  userName: string;
  isRetake: boolean;
}

export default function PlacementClient({ userId, userName, isRetake }: Props) {
  const [step, setStep] = useState<"onboarding" | "loading_questions" | "test" | "result">(isRetake ? "loading_questions" : "onboarding");
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [targetExam, setTargetExam] = useState<"TCF" | "TEF">("TCF");
  const [questions, setQuestions] = useState<PlacementQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Array<{ selected: number; correct: boolean; time_ms: number }>>([]);
  const [result, setResult] = useState<{ level: CEFRLevel; score: number } | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const router = useRouter();
  const supabase = createClient();

  // For retake, fetch questions immediately
  useEffect(() => {
    if (isRetake) fetchQuestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchQuestions = async () => {
    setStep("loading_questions");
    try {
      const res = await fetch("/api/ai/placement-questions", { method: "POST" });
      const data = await res.json();
      if (data.questions?.length >= 10) {
        setQuestions(data.questions);
      } else {
        setQuestions(staticQuestions as PlacementQuestion[]);
      }
    } catch {
      setQuestions(staticQuestions as PlacementQuestion[]);
    }
    setStep("test");
    setStartTime(Date.now());
  };

  const toggleLang = (lang: string) => {
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  };

  const handleAnswer = async (selected: number) => {
    const q = questions[currentQ];
    const isCorrect = selected === q.correct_index;
    const timeTaken = Date.now() - startTime;
    const newAnswers = [...answers, { selected, correct: isCorrect, time_ms: timeTaken }];
    setAnswers(newAnswers);

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
      setStartTime(Date.now());
    } else {
      const score = newAnswers.filter(a => a.correct).length;

      // Level-aware placement: find the highest level where user got ≥2/3 correct
      const levelOrder: CEFRLevel[] = ["A0", "A1", "A2", "B1", "B2"];
      const scoreByLevel: Record<string, { correct: number; total: number }> = {};
      newAnswers.forEach((a, i) => {
        const qLevel = questions[i]?.level || "A0";
        if (!scoreByLevel[qLevel]) scoreByLevel[qLevel] = { correct: 0, total: 0 };
        scoreByLevel[qLevel].total++;
        if (a.correct) scoreByLevel[qLevel].correct++;
      });

      // Find highest level where user answered at least 2/3 correctly
      // DON'T break — a tricky low-level question shouldn't cap you at A0
      let level: CEFRLevel = "A0";
      let passedLevels = 0;
      for (const lvl of levelOrder) {
        const s = scoreByLevel[lvl];
        if (s && s.total > 0 && s.correct / s.total >= 0.65) {
          level = lvl;
          passedLevels++;
        }
      }

      // Sanity check: if user got 50%+ overall but landed on A0,
      // they likely know more than A0 — bump to at least A1
      const overallPct = score / questions.length;
      if (level === "A0" && overallPct >= 0.5 && passedLevels <= 1) {
        // Check if they passed ANY level above A0
        for (const lvl of levelOrder.slice(1)) {
          const s = scoreByLevel[lvl];
          if (s && s.total > 0 && s.correct / s.total >= 0.5) {
            level = lvl; // Give credit for partial knowledge
          }
        }
        // If still A0 after that, at least bump to A1 with 50%+ overall
        if (level === "A0") level = "A1";
      }
      setResult({ level, score });
      setStep("result");

      // AI analysis
      fetch("/api/ai/placement-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, total: questions.length, answers: newAnswers.map((a, i) => ({ question_index: i, ...a, level: questions[i]?.level, skill_tested: questions[i]?.skill_tested || "mixed" })), determinedLevel: level }),
      }).then(r => r.json()).then(d => { if (d.analysis) setAiAnalysis(d.analysis); }).catch(() => {});
    }
  };

  const handleFinish = async () => {
    if (!result) return;
    setLoading(true);

    if (!isRetake) {
      // First time: set up profile + cards
      await supabase.from("profiles").update({
        current_level: result.level, native_languages: languages,
        preferred_translation: languages.includes("pa") ? "pa" : languages.includes("hi") ? "hi" : "en",
        target_exam: targetExam, onboarding_complete: true,
      }).eq("id", userId);

      // Initialize cards — ONLY at the determined level (not lower levels)
      // Study sessions will pull from one level below as support if needed
      const { data: words } = await supabase.from("words").select("id").eq("cefr_level", result.level).order("tcf_frequency", { ascending: false });
      if (words?.length) {
        const userCards = words.map(w => ({ user_id: userId, word_id: w.id }));
        for (let i = 0; i < userCards.length; i += 50) {
          await supabase.from("user_cards").insert(userCards.slice(i, i + 50));
        }
      }
    } else {
      // Retake: update level AND seed cards for the new level if they don't exist yet
      await supabase.from("profiles").update({ current_level: result.level }).eq("id", userId);

      // Get words at the new level that user doesn't already have cards for
      const { data: existingCards } = await supabase
        .from("user_cards")
        .select("word_id")
        .eq("user_id", userId);
      const existingWordIds = new Set((existingCards || []).map(c => c.word_id));

      const { data: newLevelWords } = await supabase
        .from("words")
        .select("id")
        .eq("cefr_level", result.level)
        .order("tcf_frequency", { ascending: false });

      const wordsToAdd = (newLevelWords || []).filter(w => !existingWordIds.has(w.id));
      if (wordsToAdd.length > 0) {
        const newCards = wordsToAdd.map(w => ({ user_id: userId, word_id: w.id }));
        for (let i = 0; i < newCards.length; i += 50) {
          await supabase.from("user_cards").insert(newCards.slice(i, i + 50));
        }
      }
    }

    // Save result
    await supabase.from("placement_results").insert({
      user_id: userId, score: result.score, total_questions: questions.length,
      determined_level: result.level, answers: answers.map((a, i) => ({ question_index: i, ...a })),
    });

    router.push("/dashboard");
  };

  const handleSkipBeginner = async () => {
    setQuestions(staticQuestions as PlacementQuestion[]);
    setResult({ level: "A0", score: 0 });
    setStep("result");
  };

  // ─── ONBOARDING (first time only) ───
  if (step === "onboarding") {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="w-full max-w-md animate-fade-up">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🇫🇷</div>
            <h1 className="text-2xl font-extrabold">Welcome, {userName || "there"}!</h1>
            <p className="text-brand-muted text-sm mt-2">Let&apos;s set up your learning path</p>
          </div>

          <div className="mb-6">
            <label className="text-sm font-semibold text-brand-muted mb-3 block">What languages do you speak?</label>
            <div className="flex gap-3">
              {[{ code: "en", label: "English", emoji: "🇬🇧" }, { code: "pa", label: "ਪੰਜਾਬੀ", emoji: "🇮🇳" }, { code: "hi", label: "हिन्दी", emoji: "🇮🇳" }].map(lang => (
                <button key={lang.code} onClick={() => toggleLang(lang.code)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${languages.includes(lang.code) ? "border-brand-accent bg-brand-accent/10 text-brand-accent" : "border-brand-border bg-brand-surface text-brand-dim"}`}>
                  {lang.emoji} {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <label className="text-sm font-semibold text-brand-muted mb-3 block">Target exam?</label>
            <div className="flex gap-3">
              {(["TCF", "TEF"] as const).map(exam => (
                <button key={exam} onClick={() => setTargetExam(exam)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${targetExam === exam ? "border-brand-gold bg-brand-gold/10 text-brand-gold" : "border-brand-border bg-brand-surface text-brand-dim"}`}>
                  🎯 {exam} Canada
                </button>
              ))}
            </div>
          </div>

          <button onClick={fetchQuestions} className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold glow-accent">
            Take Placement Test →
          </button>
          <button onClick={handleSkipBeginner} className="w-full mt-3 py-3 rounded-xl border border-brand-border text-brand-dim text-sm">
            Skip — I&apos;m a complete beginner (A0)
          </button>
        </div>
      </div>
    );
  }

  // ─── LOADING QUESTIONS ───
  if (step === "loading_questions") {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-5xl mb-4">🧠</div>
          <p className="text-brand-muted">Generating fresh placement questions...</p>
        </div>
      </div>
    );
  }

  // ─── TEST ───
  if (step === "test" && questions.length > 0) {
    const q = questions[currentQ];
    const progress = (currentQ / questions.length) * 100;

    return (
      <div className="min-h-screen bg-brand-bg">
        <div className="max-w-xl mx-auto px-5 py-10">
          <div className="flex items-center gap-4 mb-10">
            <span className="text-xs text-brand-dim font-semibold">{currentQ + 1}/{questions.length}</span>
            <div className="flex-1 h-1.5 rounded-full bg-brand-border">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-purple-400 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] text-brand-dim px-2 py-1 rounded-full bg-brand-surface border border-brand-border">{q.level}</span>
          </div>

          <div key={currentQ} className="animate-fade-up">
            <h2 className="text-xl font-bold mb-8 leading-relaxed">{q.question}</h2>
            <div className="flex flex-col gap-3">
              {q.options.map((opt, i) => (
                <button key={i} onClick={() => handleAnswer(i)}
                  className="py-4 px-5 rounded-2xl border border-brand-border bg-brand-surface text-left font-medium hover:border-brand-accent hover:translate-x-1 transition-all flex items-center gap-4">
                  <span className="w-7 h-7 rounded-lg bg-brand-accent/10 flex items-center justify-center text-xs font-bold text-brand-accent shrink-0">{String.fromCharCode(65 + i)}</span>
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
    const pct = Math.round((result.score / Math.max(questions.length, 1)) * 100);
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="text-center max-w-sm animate-scale-in">
          <div className="text-7xl mb-4">{pct >= 70 ? "🎉" : pct >= 40 ? "👏" : "🚀"}</div>
          <h1 className="text-3xl font-black mb-2">Your level: <span className="text-gradient">{result.level}</span></h1>
          <p className="text-brand-muted text-sm mb-2">{result.score}/{questions.length} correct ({pct}%)</p>

          {aiAnalysis && (
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-4 text-left mb-6 animate-fade-up">
              <div className="flex items-center gap-2 mb-3"><span>🤖</span><span className="font-bold text-xs">AI Coach Analysis</span></div>
              {aiAnalysis.encouragement && <p className="text-sm text-brand-muted mb-3">{aiAnalysis.encouragement}</p>}
              {aiAnalysis.first_week_focus && (
                <div className="bg-brand-accent/5 rounded-lg px-3 py-2 mt-2">
                  <span className="text-[10px] text-brand-accent font-semibold">📌 First week: </span>
                  <span className="text-xs text-brand-muted">{aiAnalysis.first_week_focus}</span>
                </div>
              )}
            </div>
          )}

          <button onClick={handleFinish} disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold glow-accent disabled:opacity-50">
            {loading ? "Setting up..." : isRetake ? "Update My Level →" : "Start Learning →"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
