"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Word, TranslationLang, CEFRLevel } from "@/types";

interface Props {
  words: Word[];
  cardMap: Record<string, { status: string; accuracy: number; mnemonic: string | null }>;
  userLevel: string;
  preferredLang: TranslationLang;
}

const LEVELS: CEFRLevel[] = ["A0", "A1", "A2", "B1", "B2"];
const STATUS_COLORS: Record<string, string> = {
  mastered: "bg-brand-success/20 text-brand-success",
  review: "bg-brand-accent/20 text-brand-accent",
  learning: "bg-brand-warning/20 text-brand-warning",
  new: "bg-brand-border text-brand-dim",
  burned: "bg-brand-gold/20 text-brand-gold",
};
const STATUS_LABELS: Record<string, string> = {
  mastered: "Mastered",
  review: "Reviewing",
  learning: "Learning",
  new: "New",
  burned: "Burned 🔥",
};

export default function WordBrowserClient({ words, cardMap, userLevel, preferredLang }: Props) {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showLang, setShowLang] = useState<TranslationLang>(preferredLang);

  const categories = useMemo(
    () => {
      const seen: Record<string, true> = {};
      const uniqueCategories: string[] = [];

      for (const word of words) {
        const category = word.category;
        if (!seen[category]) {
          seen[category] = true;
          uniqueCategories.push(category);
        }
      }

      return uniqueCategories.sort();
    },
    [words]
  );

  const filtered = useMemo(() => {
    return words.filter((w) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !w.french.toLowerCase().includes(q) &&
          !w.english.toLowerCase().includes(q) &&
          !(w.hindi || "").toLowerCase().includes(q) &&
          !(w.punjabi || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (levelFilter !== "all" && w.cefr_level !== levelFilter) return false;
      if (categoryFilter !== "all" && w.category !== categoryFilter) return false;
      if (statusFilter !== "all") {
        const card = cardMap[w.id];
        const status = card?.status || "new";
        if (status !== statusFilter) return false;
      }
      return true;
    });
  }, [words, search, levelFilter, categoryFilter, statusFilter, cardMap]);

  const getTranslation = (w: Word) => {
    if (showLang === "pa") return w.punjabi || w.english;
    if (showLang === "hi") return w.hindi || w.english;
    return w.english;
  };

  // Stats
  const totalMastered = Object.values(cardMap).filter((c) => c.status === "mastered").length;
  const totalLearning = Object.values(cardMap).filter(
    (c) => c.status === "learning" || c.status === "review"
  ).length;

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-brand-dim hover:text-brand-text text-xl">←</Link>
          <div>
            <h1 className="text-2xl font-extrabold">Word Bank</h1>
            <p className="text-brand-dim text-xs">
              {words.length} words · {totalMastered} mastered · {totalLearning} learning
            </p>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search in French, English, ਪੰਜਾਬੀ, हिन्दी..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-surface text-brand-text text-sm focus:border-brand-accent focus:outline-none transition-colors mb-4"
        />

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {/* Level */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-brand-border bg-brand-surface text-brand-text text-xs focus:border-brand-accent focus:outline-none"
          >
            <option value="all">All Levels</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-brand-border bg-brand-surface text-brand-text text-xs focus:border-brand-accent focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-brand-border bg-brand-surface text-brand-text text-xs focus:border-brand-accent focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="mastered">Mastered</option>
            <option value="review">Reviewing</option>
            <option value="learning">Learning</option>
            <option value="new">New</option>
          </select>

          {/* Language toggle */}
          <div className="flex gap-1 ml-auto">
            {(["en", "pa", "hi"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setShowLang(lang)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                  showLang === lang
                    ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                    : "border-brand-border text-brand-dim"
                }`}
              >
                {lang === "en" ? "EN" : lang === "pa" ? "ਪੰ" : "हि"}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-[10px] text-brand-dim mb-3">{filtered.length} words</p>

        {/* Word List */}
        <div className="space-y-2">
          {filtered.map((w) => {
            const card = cardMap[w.id];
            const status = card?.status || "new";
            const isExpanded = expanded === w.id;

            return (
              <div
                key={w.id}
                onClick={() => setExpanded(isExpanded ? null : w.id)}
                className={`bg-brand-surface border rounded-2xl p-4 cursor-pointer transition-all ${
                  isExpanded ? "border-brand-accent/40 shadow-lg shadow-brand-accent/5" : "border-brand-border hover:border-brand-accent/20"
                }`}
              >
                {/* Main row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-lg font-bold">{w.french}</span>
                      {w.gender && (
                        <span className="ml-1.5 text-[10px] text-brand-dim">({w.gender})</span>
                      )}
                    </div>
                    <span className="text-brand-muted text-sm">{getTranslation(w)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-accent/10 text-brand-accent font-bold">
                      {w.cefr_level}
                    </span>
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-brand-border space-y-2 animate-fade-up">
                    {/* All translations */}
                    <div className="flex gap-4 text-sm">
                      <span>🇬🇧 {w.english}</span>
                      {w.punjabi && <span className="text-brand-punjabi">ਪੰ: {w.punjabi}</span>}
                      {w.hindi && <span className="text-brand-hindi">हि: {w.hindi}</span>}
                    </div>

                    {/* Details */}
                    <div className="flex gap-2 flex-wrap">
                      {w.part_of_speech && (
                        <span className="text-[10px] bg-brand-border px-2 py-0.5 rounded-full text-brand-muted">
                          {w.part_of_speech}
                        </span>
                      )}
                      <span className="text-[10px] bg-brand-border px-2 py-0.5 rounded-full text-brand-muted">
                        {w.category}
                      </span>
                      {w.tcf_frequency >= 8 && (
                        <span className="text-[10px] bg-brand-gold/10 px-2 py-0.5 rounded-full text-brand-gold">
                          TCF frequent
                        </span>
                      )}
                    </div>

                    {/* Example */}
                    {w.example_sentence && (
                      <div className="bg-brand-accent/5 rounded-lg px-3 py-2">
                        <p className="text-sm italic text-brand-muted">&ldquo;{w.example_sentence}&rdquo;</p>
                        {w.example_translation_en && (
                          <p className="text-xs text-brand-dim mt-1">{w.example_translation_en}</p>
                        )}
                      </div>
                    )}

                    {/* False friend warning */}
                    {w.false_friend_warning && (
                      <div className="bg-brand-warning/10 border border-brand-warning/20 rounded-lg px-3 py-2 text-xs text-brand-warning">
                        ⚠️ {w.false_friend_warning}
                      </div>
                    )}

                    {/* AI Mnemonic */}
                    {card?.mnemonic && (
                      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-purple-400 font-semibold">🧠 AI Mnemonic: </span>
                        <span className="text-xs text-brand-muted">{card.mnemonic}</span>
                      </div>
                    )}

                    {/* Accuracy */}
                    {card && card.accuracy > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-brand-dim">Your accuracy:</span>
                        <div className="w-16 h-1 rounded-full bg-brand-border">
                          <div
                            className={`h-full rounded-full ${card.accuracy >= 80 ? "bg-brand-success" : "bg-brand-warning"}`}
                            style={{ width: `${card.accuracy}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-brand-muted">{card.accuracy}%</span>
                      </div>
                    )}

                    {/* Notes */}
                    {w.notes && (
                      <p className="text-[10px] text-brand-dim">💡 {w.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-brand-dim text-sm">
              No words match your filters
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
