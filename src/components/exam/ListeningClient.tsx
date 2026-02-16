"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface Props {
  level: string;
  examType: string;
}

type Phase = "select" | "loading" | "listen" | "quiz" | "results";

export default function ListeningClient({ level, examType }: Props) {
  const [phase, setPhase] = useState<Phase>("select");
  const [drill, setDrill] = useState<any>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [playsLeft, setPlaysLeft] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speak = useCallback((text: string, rate: number = 0.85) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsPlaying(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = rate;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith("fr") && v.localService) || voices.find(v => v.lang.startsWith("fr"));
    if (frVoice) utterance.voice = frVoice;

    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const generateDrill = async (scenario: string) => {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch("/api/exam/listening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, examType }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setPhase("select"); return; }

      setDrill(data.drill);
      setCurrentQ(0);
      setAnswers([]);
      setPlaysLeft(2);
      setShowTranscript(false);
      setPhase("listen");
    } catch {
      setError("Network error");
      setPhase("select");
    }
  };

  const playAudio = () => {
    if (playsLeft <= 0 || !drill?.transcript) return;
    speak(drill.transcript, drill.play_speed || 0.85);
    setPlaysLeft(p => p - 1);
  };

  const startQuiz = () => {
    setPhase("quiz");
    setShowExplanation(false);
  };

  const handleAnswer = (idx: number) => {
    setAnswers([...answers, idx]);
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    const questions = drill?.questions || [];
    if (currentQ < questions.length - 1) {
      setCurrentQ(p => p + 1);
      setShowExplanation(false);
    } else {
      setPhase("results");
    }
  };

  const questions = drill?.questions || [];

  // ─── SELECT ───
  if (phase === "select") {
    return (
      <div className="min-h-screen bg-brand-bg">
        <div className="max-w-2xl mx-auto px-5 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/dashboard" className="text-brand-dim hover:text-brand-text text-xl">←</Link>
            <div>
              <h1 className="text-2xl font-extrabold">🎧 Listening Practice</h1>
              <p className="text-brand-dim text-xs">Compréhension orale · {examType} · {level}</p>
            </div>
          </div>

          {error && (
            <div className="bg-brand-error/10 border border-brand-error/20 rounded-xl px-4 py-3 text-sm text-brand-error mb-4">{error}</div>
          )}

          <p className="text-brand-muted text-sm mb-6">Choose a listening scenario. AI generates the passage, and your browser reads it aloud in French.</p>

          <div className="space-y-3">
            {[
              { key: "conversation", icon: "💬", title: "Conversation", desc: "Two people talking — casual or professional" },
              { key: "announcement", icon: "📢", title: "Public Announcement", desc: "Train station, airport, store, or school" },
              { key: "voicemail", icon: "📱", title: "Voicemail", desc: "A phone message to respond to" },
              { key: "news", icon: "📰", title: "News Bulletin", desc: "Short radio news report" },
              { key: "instruction", icon: "📋", title: "Instructions", desc: "Directions, recipe, or how-to" },
            ].map(s => (
              <button key={s.key} onClick={() => generateDrill(s.key)} className="w-full bg-brand-surface border border-brand-border rounded-2xl p-5 text-left hover:border-brand-accent/30 transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <div className="font-bold text-sm">{s.title}</div>
                    <div className="text-[10px] text-brand-muted">{s.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── LOADING ───
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center animate-fade-up">
          <div className="text-5xl mb-4 animate-pulse">🎧</div>
          <p className="text-brand-muted font-semibold">Generating listening exercise...</p>
          <p className="text-brand-dim text-xs mt-2">Creating a {level}-level audio scenario</p>
        </div>
      </div>
    );
  }

  // ─── LISTEN PHASE ───
  if (phase === "listen" && drill) {
    return (
      <div className="min-h-screen bg-brand-bg">
        <div className="max-w-2xl mx-auto px-5 py-8 animate-fade-up">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🎧</div>
            <h2 className="text-xl font-bold">Listen carefully</h2>
            {drill.scenario_description && (
              <p className="text-brand-muted text-sm mt-1">Context: {drill.scenario_description}</p>
            )}
          </div>

          {/* Audio player */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-8 text-center mb-6">
            <button
              onClick={playAudio}
              disabled={playsLeft <= 0 || isPlaying}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 transition-all ${
                isPlaying
                  ? "bg-brand-accent/20 border-2 border-brand-accent animate-pulse"
                  : playsLeft > 0
                  ? "bg-brand-accent/10 border-2 border-brand-accent/30 hover:bg-brand-accent/20 hover:scale-105"
                  : "bg-brand-border opacity-50"
              }`}
            >
              {isPlaying ? "🔊" : "▶️"}
            </button>
            <p className="text-sm text-brand-muted">
              {isPlaying ? "Playing..." : playsLeft > 0 ? `Tap to play (${playsLeft} plays left)` : "No plays remaining"}
            </p>
            <p className="text-[10px] text-brand-dim mt-1">Just like the real exam — limited replays!</p>
          </div>

          {/* Key vocabulary hint */}
          {drill.key_vocabulary && drill.key_vocabulary.length > 0 && (
            <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl p-4 mb-6">
              <div className="text-[10px] text-brand-accent font-semibold mb-2">Key vocabulary to listen for:</div>
              <div className="flex flex-wrap gap-2">
                {drill.key_vocabulary.map((v: any, i: number) => (
                  <span key={i} className="text-xs bg-brand-accent/10 text-brand-accent px-2 py-1 rounded-lg">
                    {v.french} — {v.english}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={startQuiz}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold text-lg hover:scale-[1.01] transition-transform"
          >
            I&apos;m ready — Start Questions →
          </button>
        </div>
      </div>
    );
  }

  // ─── QUIZ PHASE ───
  if (phase === "quiz" && drill) {
    const q = questions[currentQ];
    if (!q) { setPhase("results"); return null; }
    const isAnswered = answers.length > currentQ;
    const isCorrect = isAnswered && answers[currentQ] === q.correct_index;

    return (
      <div className="min-h-screen bg-brand-bg">
        <div className="max-w-2xl mx-auto px-5 py-8 animate-fade-up">
          {/* Progress */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-brand-dim">Question {currentQ + 1}/{questions.length}</span>
            <span className="text-xs text-brand-dim">🎧 Listening</span>
          </div>
          <div className="h-1 rounded-full bg-brand-border mb-6">
            <div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: `${((currentQ + (isAnswered ? 1 : 0)) / questions.length) * 100}%` }} />
          </div>

          {/* Question */}
          <div className="mb-4">
            <h3 className="text-base font-bold mb-1">{q.question}</h3>
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
                <button key={i} onClick={() => !isAnswered && handleAnswer(i)} disabled={isAnswered}
                  className={`w-full py-3 px-4 rounded-xl border text-left text-sm font-medium transition-all ${style}`}>
                  <span className="mr-3 text-brand-accent font-bold">{String.fromCharCode(65 + i)}</span>{opt}
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
              <button onClick={nextQuestion} className="w-full mt-3 py-3 rounded-xl bg-brand-accent text-white font-bold text-sm">
                {currentQ < questions.length - 1 ? "Next Question →" : "See Results"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── RESULTS ───
  if (phase === "results" && drill) {
    const correct = answers.filter((a, i) => questions[i] && a === questions[i].correct_index).length;
    const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

    return (
      <div className="min-h-screen bg-brand-bg">
        <div className="max-w-2xl mx-auto px-5 py-8 text-center animate-scale-in">
          <div className="text-7xl mb-4">{pct >= 75 ? "🎉" : pct >= 50 ? "👏" : "💪"}</div>
          <h2 className="text-3xl font-black mb-1">{correct}/{questions.length}</h2>
          <p className="text-brand-muted text-sm mb-6">{pct}% — Listening comprehension</p>

          {/* Show transcript */}
          <button onClick={() => setShowTranscript(!showTranscript)} className="text-brand-accent text-sm mb-4 hover:underline">
            {showTranscript ? "Hide transcript" : "Show transcript"}
          </button>

          {showTranscript && drill.transcript && (
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 text-left mb-4">
              <div className="text-[10px] text-brand-dim uppercase tracking-wider mb-2 font-semibold">Transcript</div>
              <p className="text-sm text-brand-text mb-2">{drill.transcript}</p>
              {drill.transcript_translation && (
                <p className="text-xs text-brand-dim italic">{drill.transcript_translation}</p>
              )}
            </div>
          )}

          {drill.listening_tip && (
            <div className="bg-brand-gold/5 border border-brand-gold/20 rounded-xl px-4 py-3 text-left mb-6">
              <span className="text-[10px] text-brand-gold font-semibold">💡 Tip: </span>
              <span className="text-xs text-brand-muted">{drill.listening_tip}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setPhase("select")} className="flex-1 py-3 rounded-xl bg-brand-accent text-white font-bold text-sm">
              New Exercise
            </button>
            <Link href="/dashboard" className="flex-1 py-3 rounded-xl border border-brand-border text-sm font-semibold text-center">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
