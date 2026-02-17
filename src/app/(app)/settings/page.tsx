"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const MIN_GOAL = 5;
const MAX_GOAL = 100;
const DEFAULT_DAILY_GOAL = 20;
const UNLIMITED_SENTINEL = 999;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  return Math.max(min, Math.min(max, normalized));
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);
  };

  const updateField = async (field: string, value: any) => {
    setSaving(true);
    setMessage(null);
    let normalized = value;
    if (field === "daily_goal") normalized = clamp(value, MIN_GOAL, MAX_GOAL, DEFAULT_DAILY_GOAL);
    if (field === "session_limit" && value !== null && value !== UNLIMITED_SENTINEL) {
      normalized = clamp(value, MIN_GOAL, MAX_GOAL, 25);
    }

    const { error } = await supabase.from("profiles").update({ [field]: normalized }).eq("id", profile.id);
    if (error) setMessage({ text: "Failed to save", type: "error" });
    else { setMessage({ text: "Saved!", type: "success" }); setProfile({ ...profile, [field]: normalized }); }
    setSaving(false);
    setTimeout(() => setMessage(null), 2000);
  };

  if (!profile) return <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-dim">Loading...</div>;

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-lg mx-auto px-5 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-brand-dim hover:text-brand-text text-xl">←</Link>
          <h1 className="text-2xl font-extrabold">Settings</h1>
        </div>

        {message && (
          <div className={`mb-4 text-xs px-3 py-2 rounded-lg ${message.type === "success" ? "bg-brand-success/10 text-brand-success" : "bg-brand-error/10 text-brand-error"}`}>
            {message.text}
          </div>
        )}

        {/* Profile */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-4">
          <h3 className="font-bold text-sm mb-3">👤 Profile</h3>
          <div className="text-sm text-brand-muted space-y-1">
            <p>Name: <span className="text-brand-text">{profile.name}</span></p>
            <p>Level: <span className="text-brand-accent font-bold">{profile.current_level}</span></p>
            <p>Target: <span className="text-brand-gold font-bold">{profile.target_exam || "TCF"} Canada B2</span></p>
            <p>Languages: <span className="text-brand-text">{(profile.native_languages || []).join(", ")}</span></p>
          </div>
        </div>

        {/* Daily Goal */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-4">
          <h3 className="font-bold text-sm mb-3">🎯 Daily Goal</h3>
          <p className="text-xs text-brand-dim mb-3">How many cards do you want to study per day?</p>
          <div className="grid grid-cols-5 gap-2">
            {[5, 10, 15, 20, 30].map(g => (
              <button key={g} onClick={() => updateField("daily_goal", g)} disabled={saving}
                className={`py-2 rounded-xl border text-sm font-semibold transition-all ${
                  clamp(profile.daily_goal, MIN_GOAL, MAX_GOAL, DEFAULT_DAILY_GOAL) === g ? "border-brand-accent bg-brand-accent/10 text-brand-accent" : "border-brand-border text-brand-dim hover:border-brand-accent/30"
                }`}>{g}</button>
            ))}
          </div>
        </div>

        {/* Session Size */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-4">
          <h3 className="font-bold text-sm mb-3">🃏 Session Size</h3>
          <p className="text-xs text-brand-dim mb-3">Cards shown in one study session. Daily goal remains separate progress tracking.</p>
          <div className="grid grid-cols-3 gap-2">
            {[10, 20, 30, 50, 100].map((limit) => (
              <button
                key={limit}
                onClick={() => updateField("session_limit", limit)}
                disabled={saving}
                className={`py-2 rounded-xl border text-sm font-semibold transition-all ${
                  clamp(profile.session_limit, MIN_GOAL, MAX_GOAL, 25) === limit
                    ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                    : "border-brand-border text-brand-dim hover:border-brand-accent/30"
                }`}
              >
                {limit}
              </button>
            ))}
            <button
              onClick={() => updateField("session_limit", UNLIMITED_SENTINEL)}
              disabled={saving}
              className={`py-2 rounded-xl border text-sm font-semibold transition-all ${
                profile.session_limit === UNLIMITED_SENTINEL
                  ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                  : "border-brand-border text-brand-dim hover:border-brand-accent/30"
              }`}
            >
              Unlimited
            </button>
          </div>
        </div>

        {/* Target Exam */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-4">
          <h3 className="font-bold text-sm mb-3">🎓 Target Exam</h3>
          <div className="flex gap-3">
            {(["TCF", "TEF"] as const).map(exam => (
              <button key={exam} onClick={() => updateField("target_exam", exam)} disabled={saving}
                className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  profile.target_exam === exam ? "border-brand-gold bg-brand-gold/10 text-brand-gold" : "border-brand-border text-brand-dim"
                }`}>🎯 {exam} Canada</button>
            ))}
          </div>
        </div>

        {/* Preferred Language */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-4">
          <h3 className="font-bold text-sm mb-3">🌐 Preferred Translation Language</h3>
          <p className="text-xs text-brand-dim mb-3">Used for flashcard translations and AI mnemonics</p>
          <div className="flex gap-3">
            {[
              { code: "en", label: "English" },
              { code: "pa", label: "ਪੰਜਾਬੀ" },
              { code: "hi", label: "हिन्दी" },
            ].map(lang => (
              <button key={lang.code} onClick={() => updateField("preferred_translation", lang.code)} disabled={saving}
                className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  profile.preferred_translation === lang.code ? "border-brand-accent bg-brand-accent/10 text-brand-accent" : "border-brand-border text-brand-dim"
                }`}>{lang.label}</button>
            ))}
          </div>
        </div>

        {/* Retake Placement */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-4">
          <h3 className="font-bold text-sm mb-3">📝 Placement Test</h3>
          <p className="text-xs text-brand-dim mb-3">Retake the placement test with fresh questions</p>
          <Link href="/placement" className="block w-full py-3 rounded-xl border border-brand-border text-center text-sm font-semibold hover:border-brand-accent/30 transition-colors">
            Retake Placement Test
          </Link>
        </div>

        {/* Dev Panel link */}
        <Link href="/dev" className="block text-center py-3 text-[10px] text-brand-border hover:text-brand-dim transition-colors">🛠</Link>
      </div>
    </div>
  );
}
