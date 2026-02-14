import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-brand-bg relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[10%] left-[15%] w-72 h-72 rounded-full bg-brand-accent/10 blur-[80px] animate-float" />
      <div className="absolute bottom-[15%] right-[10%] w-60 h-60 rounded-full bg-brand-hindi/10 blur-[60px] animate-float" style={{ animationDelay: "2s" }} />

      <div className="flex flex-col items-center justify-center min-h-screen px-5 text-center relative z-10">
        {/* Logo */}
        <div className="animate-fade-up">
          <div className="text-7xl mb-4 animate-float">🇫🇷</div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-gradient leading-tight">
            FrancoPath
          </h1>
          <p className="text-brand-muted text-sm tracking-[4px] uppercase mt-3">
            AI-Powered French for TCF & TEF
          </p>
        </div>

        {/* Language badges */}
        <div className="flex gap-3 mt-8 mb-10 animate-fade-up-delay flex-wrap justify-center">
          {[
            { label: "English", emoji: "🇬🇧", color: "brand-accent" },
            { label: "ਪੰਜਾਬੀ", emoji: "🇮🇳", color: "brand-punjabi" },
            { label: "हिन्दी", emoji: "🇮🇳", color: "brand-hindi" },
          ].map((lang) => (
            <span
              key={lang.label}
              className={`px-4 py-2 rounded-full border border-${lang.color}/30 bg-${lang.color}/5 text-${lang.color} text-sm font-medium`}
            >
              {lang.emoji} {lang.label}
            </span>
          ))}
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mb-10 animate-fade-up-delay">
          {[
            { icon: "🧠", title: "Spaced Repetition", desc: "SM-2 algorithm optimizes your memory" },
            { icon: "🤖", title: "AI Coach", desc: "Claude analyzes your progress & adapts" },
            { icon: "🎯", title: "TCF/TEF Prep", desc: "Exam-focused vocabulary & drills" },
          ].map((f) => (
            <div key={f.title} className="bg-brand-surface border border-brand-border rounded-2xl p-5 text-left">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-bold text-sm">{f.title}</div>
              <div className="text-brand-dim text-xs mt-1">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3 w-full max-w-xs animate-fade-up-delay">
          <Link
            href="/signup"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white text-center font-bold text-lg glow-accent hover:scale-[1.02] transition-transform"
          >
            Get Started Free →
          </Link>
          <Link
            href="/login"
            className="w-full py-3 rounded-xl border border-brand-border bg-transparent text-brand-muted text-center text-sm hover:border-brand-accent/50 transition-colors"
          >
            Already have an account? Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
