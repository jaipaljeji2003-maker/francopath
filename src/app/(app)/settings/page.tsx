"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface BYOKStatus {
  tier: "free" | "byok";
  keyValid: boolean;
  keyAddedAt: string | null;
  todayUsage: {
    mnemonics_used: number;
    drills_used: number;
    analyses_used: number;
    total_tokens_used: number;
  };
  limits: { mnemonics: number; drills: number; analyses: number } | null;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [byokStatus, setByokStatus] = useState<BYOKStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);

    const res = await fetch("/api/user/byok");
    if (res.ok) setByokStatus(await res.json());
  };

  const handleSaveKey = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/byok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: "API key saved! You now have unlimited AI features. 🎉", type: "success" });
        setApiKey("");
        loadData();
      } else {
        setMessage({ text: data.error || "Failed to save key", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error", type: "error" });
    }
    setSaving(false);
  };

  const handleRemoveKey = async () => {
    const res = await fetch("/api/user/byok", { method: "DELETE" });
    if (res.ok) {
      setMessage({ text: "API key removed. Switched back to free tier.", type: "success" });
      loadData();
    }
  };

  if (!profile) {
    return <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-dim">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-lg mx-auto px-5 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-brand-dim hover:text-brand-text text-xl">←</Link>
          <h1 className="text-2xl font-extrabold">Settings</h1>
        </div>

        {/* Profile */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-4">
          <h3 className="font-bold text-sm mb-3">👤 Profile</h3>
          <div className="text-sm text-brand-muted space-y-1">
            <p>Name: <span className="text-brand-text">{profile.name}</span></p>
            <p>Level: <span className="text-brand-accent font-bold">{profile.current_level}</span></p>
            <p>Target: <span className="text-brand-gold font-bold">{profile.target_exam || "TCF"} B2</span></p>
            <p>Languages: <span className="text-brand-text">{(profile.native_languages || []).join(", ")}</span></p>
          </div>
        </div>

        {/* AI Usage */}
        {byokStatus && (
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">🤖 AI Usage Today</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                byokStatus.tier === "byok"
                  ? "bg-brand-gold/20 text-brand-gold"
                  : "bg-brand-accent/20 text-brand-accent"
              }`}>
                {byokStatus.tier === "byok" ? "♾️ BYOK" : "🆓 FREE"}
              </span>
            </div>

            {byokStatus.tier === "free" && byokStatus.limits && (
              <div className="space-y-2">
                {[
                  { label: "Mnemonics", used: byokStatus.todayUsage.mnemonics_used, max: byokStatus.limits.mnemonics },
                  { label: "Drills", used: byokStatus.todayUsage.drills_used, max: byokStatus.limits.drills },
                  { label: "Analyses", used: byokStatus.todayUsage.analyses_used, max: byokStatus.limits.analyses },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs text-brand-muted w-20">{item.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-brand-border">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.used >= item.max ? "bg-brand-error" : "bg-brand-accent"
                        }`}
                        style={{ width: `${Math.min((item.used / item.max) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-brand-dim font-mono">{item.used}/{item.max}</span>
                  </div>
                ))}
              </div>
            )}

            {byokStatus.tier === "byok" && (
              <div className="text-sm text-brand-muted">
                <p className="text-brand-success">✅ Unlimited AI features active</p>
                <p className="text-xs text-brand-dim mt-1">
                  Tokens used today: {byokStatus.todayUsage.total_tokens_used?.toLocaleString() || 0}
                </p>
              </div>
            )}
          </div>
        )}

        {/* BYOK Setup */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 mb-4">
          <h3 className="font-bold text-sm mb-2">🔑 Bring Your Own API Key</h3>
          <p className="text-xs text-brand-dim mb-4">
            Connect your Anthropic API key for unlimited AI mnemonics, analysis, drills, and more.
            Your key is encrypted and stored securely.
          </p>

          {byokStatus?.tier === "byok" && byokStatus.keyValid ? (
            <div>
              <div className="bg-brand-success/10 border border-brand-success/30 rounded-lg px-3 py-2 text-sm text-brand-success mb-3">
                ✅ API key connected
                {byokStatus.keyAddedAt && (
                  <span className="text-xs text-brand-dim ml-2">
                    since {new Date(byokStatus.keyAddedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <button
                onClick={handleRemoveKey}
                className="text-xs text-brand-error hover:underline"
              >
                Remove API key
              </button>
            </div>
          ) : (
            <div>
              <input
                type="password"
                placeholder="sk-ant-api03-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm font-mono focus:border-brand-accent focus:outline-none transition-colors mb-3"
              />
              <p className="text-[10px] text-brand-dim mb-3">
                Get your key at{" "}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
                  console.anthropic.com/settings/keys
                </a>
              </p>
              <button
                onClick={handleSaveKey}
                disabled={saving || !apiKey.startsWith("sk-ant-")}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold text-sm disabled:opacity-30 hover:scale-[1.02] transition-transform"
              >
                {saving ? "Validating..." : "Validate & Save Key"}
              </button>
            </div>
          )}

          {message && (
            <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${
              message.type === "success"
                ? "bg-brand-success/10 text-brand-success"
                : "bg-brand-error/10 text-brand-error"
            }`}>
              {message.text}
            </div>
          )}

          {/* Benefits */}
          <div className="mt-4 pt-4 border-t border-brand-border">
            <div className="text-[10px] text-brand-dim font-semibold mb-2 uppercase tracking-wider">BYOK Benefits</div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                "♾️ Unlimited mnemonics",
                "♾️ Unlimited drills",
                "♾️ Unlimited writing grading",
                "♾️ Unlimited mock exams",
                "🗣️ Conversation practice",
                "📝 Grammar in ਪੰਜਾਬੀ/हिन्दी",
              ].map((b) => (
                <span key={b} className="text-[10px] text-brand-muted">{b}</span>
              ))}
            </div>
            <p className="text-[10px] text-brand-dim mt-2">
              Estimated cost: $2-5/mo for light use, $10-20/mo for heavy exam prep
            </p>
          </div>
        </div>

        {/* Dev Panel link — hidden at bottom */}
        <Link href="/dev" className="block text-center py-3 text-[10px] text-brand-border hover:text-brand-dim transition-colors">
          🛠
        </Link>
      </div>
    </div>
  );
}
