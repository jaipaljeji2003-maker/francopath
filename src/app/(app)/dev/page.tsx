"use client";

import { useState } from "react";
import Link from "next/link";

export default function DevPage() {
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runAction = async (action: string, extra?: Record<string, string>) => {
    if (!secret) { setResult("Enter dev secret first"); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, secret, ...extra }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-lg mx-auto px-5 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-brand-dim hover:text-brand-text text-xl">←</Link>
          <h1 className="text-2xl font-extrabold">🛠 Dev Panel</h1>
        </div>

        {/* Secret input */}
        <input
          type="password"
          placeholder="DEV_MODE_SECRET"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-surface text-brand-text text-sm font-mono focus:border-brand-accent focus:outline-none mb-6"
        />

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => runAction("unlock_all")}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-success/20 border border-brand-success/30 text-brand-success font-bold text-sm hover:bg-brand-success/30 transition-colors disabled:opacity-50"
          >
            🔓 Unlock All Features (B2 + Exam Prep)
          </button>

          <button
            onClick={() => runAction("simulate_progress")}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-accent/20 border border-brand-accent/30 text-brand-accent font-bold text-sm hover:bg-brand-accent/30 transition-colors disabled:opacity-50"
          >
            📊 Simulate Progress (mastered cards + activity)
          </button>

          <div className="grid grid-cols-5 gap-2">
            {["A0", "A1", "A2", "B1", "B2"].map(lvl => (
              <button
                key={lvl}
                onClick={() => runAction("set_level", { level: lvl })}
                disabled={loading}
                className="py-2 rounded-lg border border-brand-border text-xs font-bold hover:border-brand-accent/30 transition-colors disabled:opacity-50"
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (confirm("This will DELETE all your progress. Continue?")) {
                runAction("reset_progress");
              }
            }}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-error/20 border border-brand-error/30 text-brand-error font-bold text-sm hover:bg-brand-error/30 transition-colors disabled:opacity-50"
          >
            🗑 Reset All Progress
          </button>

          <div className="border-t border-brand-border pt-3 mt-3">
            <div className="text-[10px] text-brand-dim uppercase tracking-wider mb-2 font-semibold">Data Management</div>
            <button
              onClick={async () => {
                if (!secret) { setResult("Enter dev secret first"); return; }
                setLoading(true);
                setResult(null);
                try {
                  const res = await fetch("/api/dev/seed-words", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ secret }),
                  });
                  const data = await res.json();
                  setResult(JSON.stringify(data, null, 2));
                } catch (e: any) { setResult(`Error: ${e.message}`); }
                setLoading(false);
              }}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-brand-gold/20 border border-brand-gold/30 text-brand-gold font-bold text-sm hover:bg-brand-gold/30 transition-colors disabled:opacity-50"
            >
              📚 Seed Expanded Word Bank (263+ words)
            </button>
          </div>
        </div>

        {/* Quick nav */}
        <div className="mt-6 pt-6 border-t border-brand-border">
          <h3 className="font-bold text-sm text-brand-muted mb-3">Quick Navigation</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/dashboard", label: "📊 Dashboard" },
              { href: "/study", label: "📖 Study" },
              { href: "/words", label: "📚 Word Bank" },
              { href: "/exam-prep", label: "🎓 Exam Prep" },
              { href: "/placement", label: "🎯 Placement" },
              { href: "/settings", label: "⚙️ Settings" },
            ].map(link => (
              <Link key={link.href} href={link.href} className="py-2 px-3 rounded-lg border border-brand-border text-xs font-semibold text-center hover:border-brand-accent/30 transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Result */}
        {result && (
          <pre className="mt-6 p-4 rounded-xl bg-brand-surface border border-brand-border text-[10px] text-brand-muted overflow-x-auto whitespace-pre-wrap">
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}
