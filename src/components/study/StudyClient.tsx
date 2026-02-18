"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateSRS } from "@/lib/srs/sm2";
import { usePronounce } from "@/hooks/usePronounce";
import type { TranslationLang } from "@/types";

interface MnemonicData {
  mnemonic: string;
  bridge_language?: string;
  sound_bridge?: string;
  loading?: boolean;
  error?: string;
}

interface CardWithWord {
  id: string;
  word_id: string;
  ease_factor: number;
  interval_days: number;
  repetition: number;
  next_review: string;
  times_seen: number;
  times_correct: number;
  times_wrong: number;
  status: string;
  ai_mnemonic: string | null;
  word: {
    french: string;
    english: string;
    hindi: string | null;
    punjabi: string | null;
    part_of_speech: string | null;
    gender: string | null;
    cefr_level: string;
    category: string;
    example_sentence: string | null;
    false_friend_warning: string | null;
    notes: string | null;
  };
}

export default function StudyClient({
  cards,
  userId,
  preferredLang,
  dailyGoal,
  deckPlanSummary,
}: {
  cards: CardWithWord[];
  userId: string;
  preferredLang: TranslationLang;
  dailyGoal: number;
  deckPlanSummary?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0, burned: 0, started: Date.now() });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [showLang, setShowLang] = useState<TranslationLang>(preferredLang);
  const [mnemonic, setMnemonic] = useState<MnemonicData | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { speak } = usePronounce();

  const fetchMnemonic = useCallback(async () => {
    if (!cards[currentIndex]) return;
    const card = cards[currentIndex];
    if (card.ai_mnemonic) { setMnemonic({ mnemonic: card.ai_mnemonic }); return; }
    setMnemonic({ mnemonic: "", loading: true });
    try {
      const res = await fetch("/api/ai/mnemonic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wordId: card.word_id, french: card.word.french, english: card.word.english,
          hindi: card.word.hindi, punjabi: card.word.punjabi,
          partOfSpeech: card.word.part_of_speech, level: card.word.cefr_level, example: card.word.example_sentence,
        }),
      });
      const data = await res.json();
      if (data.error) { setMnemonic({ mnemonic: "", error: data.error }); }
      else {
        const p = data.mnemonic && typeof data.mnemonic === "object" ? data.mnemonic : data;
        setMnemonic({ mnemonic: typeof p.mnemonic === "string" ? p.mnemonic : "", bridge_language: p.bridge_language, sound_bridge: p.sound_bridge });
      }
    } catch { setMnemonic({ mnemonic: "", error: "Couldn't load mnemonic" }); }
  }, [currentIndex, cards]);

  useEffect(() => {
    const createSession = async () => {
      const { data } = await supabase.from("study_sessions").insert({ user_id: userId, session_type: "review" }).select("id").single();
      if (data) setSessionId(data.id);
    };
    createSession();
  }, [userId, supabase]);

  const card = cards[currentIndex];
  const progress = cards.length > 0 ? (currentIndex / cards.length) * 100 : 0;

  const getTranslation = useCallback((word: CardWithWord["word"]) => {
    if (showLang === "pa") return word.punjabi || word.english;
    if (showLang === "hi") return word.hindi || word.english;
    return word.english;
  }, [showLang]);

  // Use a ref to track stats reliably (avoids React state batching issues in finishSession)
  const statsRef = useRef({ correct: 0, total: 0, burned: 0 });

  // BURN a card — too easy, remove from rotation
  const handleBurn = async () => {
    if (!card || animating) return;
    setAnimating(true);

    await supabase
      .from("user_cards")
      .update({ status: "burned", interval_days: 999 })
      .eq("id", card.id);

    statsRef.current.burned++;
    statsRef.current.total++;
    setSessionStats(prev => ({ ...prev, burned: prev.burned + 1, total: prev.total + 1 }));
    advanceCard();
  };

  const handleRate = async (quality: number) => {
    if (!card || animating) return;
    setAnimating(true);

    const isCorrect = quality >= 3;
    const srsResult = calculateSRS(
      { easeFactor: card.ease_factor, intervalDays: card.interval_days, repetition: card.repetition, nextReview: card.next_review, lastReview: null },
      quality
    );

    // Auto-burn: ease > 3.0 AND interval > 60 AND 5+ consecutive correct
    let finalStatus: "new" | "learning" | "review" | "mastered" | "burned" = srsResult.status;
    if (
      srsResult.easeFactor > 3.0 &&
      srsResult.intervalDays > 60 &&
      card.times_correct >= 4 &&
      isCorrect
    ) {
      finalStatus = "burned";
      statsRef.current.burned++;
      setSessionStats(prev => ({ ...prev, burned: prev.burned + 1 }));
    }

    await supabase.from("user_cards").update({
      ease_factor: srsResult.easeFactor, interval_days: srsResult.intervalDays,
      repetition: srsResult.repetition, next_review: srsResult.nextReview, last_review: srsResult.lastReview,
      times_seen: card.times_seen + 1, times_correct: card.times_correct + (isCorrect ? 1 : 0),
      times_wrong: card.times_wrong + (isCorrect ? 0 : 1), status: finalStatus,
    }).eq("id", card.id);

    if (sessionId) {
      await supabase.from("card_reviews").insert({ user_id: userId, user_card_id: card.id, session_id: sessionId, quality });
    }

    statsRef.current.total++;
    if (isCorrect) statsRef.current.correct++;
    setSessionStats(prev => ({ ...prev, correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));
    advanceCard();
  };

  const advanceCard = () => {
    if (currentIndex < cards.length - 1) {
      setTimeout(() => { setCurrentIndex(p => p + 1); setShowAnswer(false); setAnimating(false); setMnemonic(null); }, 200);
    } else {
      finishSession();
    }
  };

  const finishSession = async () => {
    if (sessionId) {
      const duration = Math.round((Date.now() - sessionStats.started) / 1000);
      // Use ref values which are synchronously updated (not subject to React batching)
      const finalTotal = statsRef.current.total;
      const finalCorrect = statsRef.current.correct;
      await supabase.from("study_sessions").update({
        ended_at: new Date().toISOString(), cards_reviewed: finalTotal,
        cards_correct: finalCorrect, duration_seconds: duration,
      }).eq("id", sessionId);

      fetch("/api/user/streak", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardsReviewed: finalTotal, cardsCorrect: finalCorrect, durationSeconds: duration }),
      }).catch(() => {});
    }
    setAnimating(false);
    setCurrentIndex(cards.length);
  };

  // ─── NO CARDS ───
  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="text-center animate-fade-up">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2">All caught up!</h2>
          <p className="text-brand-muted text-sm mb-6">No cards due right now. Come back later or adjust your daily goal in Settings.</p>
          <button onClick={() => router.push("/dashboard")} className="px-6 py-3 rounded-xl bg-brand-surface border border-brand-border text-sm font-semibold hover:border-brand-accent/50 transition-colors">
            ← Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ─── SESSION RESULTS ───
  if (currentIndex >= cards.length) {
    const acc = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;
    const duration = Math.round((Date.now() - sessionStats.started) / 60000);

    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="max-w-sm w-full text-center">
          <div className="animate-scale-in">
            <div className="text-7xl mb-4">{acc >= 80 ? "🎉" : acc >= 60 ? "👏" : "💪"}</div>
            <h1 className="text-3xl font-black mb-1">{acc >= 80 ? "Magnifique !" : acc >= 60 ? "Bien joué !" : "Continue !"}</h1>
            <p className="text-brand-muted text-sm">Session complete</p>
          </div>

          <div className="grid grid-cols-4 gap-3 my-8 animate-fade-up-delay">
            {[
              { label: "Accuracy", value: `${acc}%`, color: acc >= 80 ? "text-brand-success" : "text-brand-warning" },
              { label: "Cards", value: sessionStats.total, color: "text-brand-accent" },
              { label: "Time", value: `${duration}m`, color: "text-brand-muted" },
              { label: "Burned", value: sessionStats.burned, color: "text-brand-gold" },
            ].map(s => (
              <div key={s.label} className="bg-brand-surface border border-brand-border rounded-2xl p-4">
                <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-brand-dim mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 animate-fade-up-delay">
            <button onClick={() => window.location.href = "/study"} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold text-sm">Study More</button>
            <button onClick={() => router.push("/dashboard")} className="flex-1 py-3.5 rounded-xl border border-brand-border bg-brand-surface text-sm font-semibold">Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── CARD REVIEW ───
  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-xl mx-auto px-5 py-8">
        {/* Top bar */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push("/dashboard")} className="text-brand-dim hover:text-brand-text transition-colors text-xl">←</button>
          <div className="flex-1 h-1.5 rounded-full bg-brand-border">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-purple-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-brand-dim font-semibold tabular-nums">{currentIndex + 1}/{cards.length}</span>
        </div>

        {/* Language toggle */}
        {deckPlanSummary && (
          <div className="mb-4 text-center text-xs text-brand-dim">
            🧭 {deckPlanSummary}
          </div>
        )}

        <div className="flex justify-center gap-2 mb-6">
          {(["en", "pa", "hi"] as const).map(lang => (
            <button key={lang} onClick={() => setShowLang(lang)} className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${showLang === lang ? "border-brand-accent bg-brand-accent/10 text-brand-accent" : "border-brand-border text-brand-dim"}`}>
              {lang === "en" ? "EN" : lang === "pa" ? "ਪੰ" : "हि"}
            </button>
          ))}
        </div>

        {/* Card */}
        <div onClick={() => !showAnswer && setShowAnswer(true)} className={`bg-brand-surface border border-brand-border rounded-3xl p-8 text-center min-h-[320px] flex flex-col justify-center transition-all cursor-pointer ${showAnswer ? "shadow-lg shadow-brand-accent/10 border-brand-accent/30" : "hover:border-brand-accent/20"}`}>
          <div className="mb-4">
            <span className="text-[10px] px-3 py-1 rounded-full bg-brand-accent/10 text-brand-accent font-semibold tracking-wider">
              {card.word.cefr_level} · {card.word.category}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="text-4xl font-black tracking-tight">{card.word.french}</div>
            <button onClick={(e) => { e.stopPropagation(); speak(card.word.french); }} className="w-9 h-9 rounded-full bg-brand-accent/10 flex items-center justify-center text-lg hover:bg-brand-accent/20 transition-colors shrink-0" title="Listen">🔊</button>
          </div>
          <div className="text-sm text-brand-dim italic">{card.word.part_of_speech}{card.word.gender && ` (${card.word.gender})`}</div>

          {!showAnswer && <div className="mt-8 text-sm text-brand-dim">Tap to reveal · ਟੈਪ ਕਰੋ · टैप करें</div>}

          {showAnswer && (
            <div className="mt-6 animate-fade-up">
              <div className="w-16 h-px bg-brand-border mx-auto mb-5" />
              <div className="text-2xl font-bold text-brand-accent mb-3">{getTranslation(card.word)}</div>

              <div className="flex justify-center gap-5 text-sm mb-4">
                {card.word.punjabi && <span className="text-brand-punjabi font-semibold">ਪੰ: {card.word.punjabi}</span>}
                {card.word.hindi && <span className="text-brand-hindi font-semibold">हि: {card.word.hindi}</span>}
              </div>

              {card.word.example_sentence && (
                <div className="bg-brand-accent/5 border border-brand-border rounded-xl px-4 py-3 flex items-center gap-2">
                  <span className="text-sm text-brand-muted italic flex-1">&ldquo;{card.word.example_sentence}&rdquo;</span>
                  <button onClick={(e) => { e.stopPropagation(); speak(card.word.example_sentence!); }} className="text-sm hover:scale-110 transition-transform shrink-0">🔊</button>
                </div>
              )}

              {card.word.false_friend_warning && (
                <div className="mt-3 bg-brand-warning/10 border border-brand-warning/30 rounded-xl px-4 py-2 text-xs text-brand-warning">{card.word.false_friend_warning}</div>
              )}

              {card.word.notes && <div className="mt-2 text-xs text-brand-dim">💡 {card.word.notes}</div>}

              {/* AI Mnemonic */}
              {mnemonic?.mnemonic ? (
                <div className="mt-3 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3 text-left">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs">🤖</span>
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">AI Memory Trick</span>
                    {mnemonic.bridge_language && mnemonic.bridge_language !== "none" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                        {mnemonic.bridge_language === "punjabi" ? "ਪੰਜਾਬੀ bridge" : mnemonic.bridge_language === "hindi" ? "हिन्दी bridge" : "EN bridge"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-brand-muted leading-relaxed">{mnemonic.mnemonic}</p>
                </div>
              ) : mnemonic?.loading ? (
                <div className="mt-3 text-xs text-brand-dim animate-pulse text-center">🤖 Generating memory trick...</div>
              ) : mnemonic?.error ? (
                <div className="mt-3 text-xs text-brand-dim text-center">{mnemonic.error}</div>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); fetchMnemonic(); }} className="mt-3 mx-auto block text-xs px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-colors">
                  🤖 Generate Memory Trick
                </button>
              )}
            </div>
          )}
        </div>

        {/* Rating buttons + BURN */}
        {showAnswer && (
          <div className="mt-6 animate-fade-up">
            <p className="text-center text-xs text-brand-dim mb-3 font-medium">How well did you know this?</p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { q: 1, label: "Forgot", sub: "भूल गया", color: "brand-error", emoji: "😵" },
                { q: 2, label: "Hard", sub: "ਔਖਾ", color: "brand-warning", emoji: "😓" },
                { q: 4, label: "Good", sub: "ਚੰਗਾ", color: "brand-accent", emoji: "😊" },
                { q: 5, label: "Easy", sub: "आसान", color: "brand-success", emoji: "😄" },
                { q: -1, label: "Burn", sub: "Too easy", color: "brand-gold", emoji: "🔥" },
              ].map(r => (
                <button
                  key={r.q}
                  onClick={() => r.q === -1 ? handleBurn() : handleRate(r.q)}
                  disabled={animating}
                  className={`py-3 rounded-2xl border border-${r.color}/30 bg-${r.color}/5 text-${r.color} text-xs font-bold flex flex-col items-center gap-1 hover:bg-${r.color}/15 hover:scale-105 transition-all disabled:opacity-50`}
                >
                  <span className="text-xl">{r.emoji}</span>
                  <span>{r.label}</span>
                  <span className="text-[9px] opacity-60">{r.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
