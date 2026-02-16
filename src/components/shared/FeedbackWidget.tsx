"use client";

import { useState } from "react";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("general");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      await fetch("/api/user/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackType: type,
          content,
          pageUrl: window.location.pathname,
          rating: rating || undefined,
        }),
      });
      setSent(true);
      setTimeout(() => { setOpen(false); setSent(false); setContent(""); setRating(0); }, 1500);
    } catch { /* ignore */ }
    setSending(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-brand-accent text-white flex items-center justify-center text-lg shadow-lg shadow-brand-accent/20 hover:scale-110 transition-transform"
        title="Send feedback"
      >
        💬
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 bg-brand-surface border border-brand-border rounded-2xl shadow-xl shadow-black/20 animate-scale-in">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">Send Feedback</h3>
          <button onClick={() => setOpen(false)} className="text-brand-dim hover:text-brand-text text-lg">×</button>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm text-brand-muted">Thanks for your feedback!</p>
          </div>
        ) : (
          <>
            {/* Type selector */}
            <div className="flex gap-1 mb-3">
              {[
                { key: "bug", label: "🐛 Bug" },
                { key: "feature", label: "💡 Feature" },
                { key: "ai_quality", label: "🤖 AI" },
                { key: "word_issue", label: "📝 Word" },
                { key: "general", label: "💬 Other" },
              ].map(t => (
                <button key={t.key} onClick={() => setType(t.key)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                    type === t.key ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/20" : "text-brand-dim border border-transparent"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Rating for AI feedback */}
            {type === "ai_quality" && (
              <div className="flex gap-1 mb-3 justify-center">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setRating(s)}
                    className={`text-xl transition-transform ${s <= rating ? "scale-110" : "opacity-30"}`}>
                    ⭐
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={type === "bug" ? "Describe the bug..." : type === "feature" ? "What would you like?" : "Your feedback..."}
              className="w-full h-24 px-3 py-2 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm resize-none focus:border-brand-accent focus:outline-none"
            />

            <button onClick={submit} disabled={!content.trim() || sending}
              className="w-full mt-2 py-2.5 rounded-xl bg-brand-accent text-white font-bold text-sm disabled:opacity-40">
              {sending ? "Sending..." : "Submit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
