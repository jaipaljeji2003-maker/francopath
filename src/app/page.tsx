import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-brand-bg relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-[5%] left-[10%] w-96 h-96 rounded-full bg-brand-accent/8 blur-[100px] animate-float" />
      <div className="absolute bottom-[10%] right-[5%] w-80 h-80 rounded-full bg-purple-500/8 blur-[80px] animate-float" style={{ animationDelay: "3s" }} />
      <div className="absolute top-[40%] right-[20%] w-48 h-48 rounded-full bg-brand-hindi/6 blur-[60px] animate-float" style={{ animationDelay: "1.5s" }} />

      {/* Nav */}
      <nav className="relative z-10 max-w-5xl mx-auto px-5 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🇫🇷</span>
          <span className="text-xl font-black tracking-tight text-gradient">FrancoPath</span>
        </div>
        <Link
          href="/login"
          className="text-sm text-brand-muted hover:text-brand-accent transition-colors"
        >
          Log in
        </Link>
      </nav>

      {/* Hero */}
      <div className="relative z-10 max-w-4xl mx-auto px-5 pt-16 pb-20 text-center">
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 bg-brand-surface border border-brand-border rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-brand-success animate-pulse" />
            <span className="text-xs text-brand-muted">AI-powered French for Canadian immigration</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.05] mb-6">
            <span className="text-gradient">Master French</span>
            <br />
            <span className="text-brand-text">for TCF & TEF</span>
          </h1>

          <p className="text-brand-muted text-lg md:text-xl max-w-xl mx-auto mb-4 leading-relaxed">
            Spaced repetition + AI coaching, designed for
            English, Punjabi, and Hindi speakers
          </p>

          {/* Language badges */}
          <div className="flex gap-3 justify-center mb-10 flex-wrap">
            <span className="px-4 py-2 rounded-full border border-brand-accent/20 bg-brand-accent/5 text-brand-accent text-sm font-medium">
              🇬🇧 English
            </span>
            <span className="px-4 py-2 rounded-full border border-brand-punjabi/20 bg-brand-punjabi/5 text-brand-punjabi text-sm font-medium">
              ਪੰਜਾਬੀ
            </span>
            <span className="px-4 py-2 rounded-full border border-brand-hindi/20 bg-brand-hindi/5 text-brand-hindi text-sm font-medium">
              हिन्दी
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-up-delay">
          <Link
            href="/signup"
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold text-lg glow-accent hover:scale-[1.03] transition-transform"
          >
            Start Learning Free →
          </Link>
          <a
            href="#features"
            className="px-8 py-4 rounded-2xl border border-brand-border text-brand-muted font-semibold hover:border-brand-accent/40 transition-colors"
          >
            See how it works
          </a>
        </div>
      </div>

      {/* How it works */}
      <div id="features" className="relative z-10 max-w-4xl mx-auto px-5 py-20">
        <h2 className="text-3xl font-black text-center mb-12">
          How <span className="text-gradient">FrancoPath</span> works
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              icon: "🎯",
              title: "Take Placement Test",
              desc: "15 adaptive questions determine your CEFR level (A0→B2). AI analyzes your strengths and weaknesses.",
            },
            {
              step: "02",
              icon: "🧠",
              title: "Study with SM-2",
              desc: "Scientifically-proven spaced repetition shows you words at the perfect moment for long-term memory.",
            },
            {
              step: "03",
              icon: "🤖",
              title: "AI Coaches You",
              desc: "Claude generates Hindi/Punjabi memory bridges, tracks your progress, and adapts to your learning style.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-brand-surface border border-brand-border rounded-2xl p-6 hover:border-brand-accent/30 transition-all group"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{item.icon}</span>
                <span className="text-[10px] text-brand-dim font-bold tracking-widest">STEP {item.step}</span>
              </div>
              <h3 className="text-lg font-bold mb-2 group-hover:text-brand-accent transition-colors">{item.title}</h3>
              <p className="text-sm text-brand-muted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sound bridge showcase */}
      <div className="relative z-10 max-w-4xl mx-auto px-5 py-16">
        <div className="bg-gradient-to-br from-brand-accent/10 to-purple-500/10 border border-brand-accent/20 rounded-3xl p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-black mb-3">
            🌉 Language Bridge Technology
          </h2>
          <p className="text-brand-muted mb-8 max-w-xl">
            Our AI finds sound connections between French and your native language, creating unforgettable memory bridges.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { french: "penser", means: "to think", bridge: "ਪੈਸੇ (paise)", tip: "Think about money! 💰", lang: "Punjabi" },
              { french: "rue", means: "street", bridge: "रू (roo)", tip: "The street makes you go 'roo'! 🛣️", lang: "Hindi" },
              { french: "chapeau", means: "hat", bridge: "शैम्पू (shampoo)", tip: "Shampoo under your hat! 🎩", lang: "Hindi" },
            ].map((b) => (
              <div key={b.french} className="bg-brand-bg/50 rounded-2xl p-5 border border-brand-border">
                <div className="text-2xl font-black text-brand-accent mb-1">{b.french}</div>
                <div className="text-xs text-brand-dim mb-3">{b.means}</div>
                <div className="text-sm text-brand-punjabi font-semibold mb-1">
                  Sounds like: {b.bridge}
                </div>
                <div className="text-xs text-brand-muted">{b.tip}</div>
                <div className="text-[9px] text-brand-dim mt-2">via {b.lang}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features grid */}
      <div className="relative z-10 max-w-4xl mx-auto px-5 py-16">
        <h2 className="text-3xl font-black text-center mb-12">Everything you need</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { icon: "🧠", title: "SM-2 Spaced Repetition", desc: "Optimal review intervals" },
            { icon: "🤖", title: "AI Mnemonics", desc: "Hindi/Punjabi sound bridges" },
            { icon: "📊", title: "Progress Tracking", desc: "Dashboard + streak calendar" },
            { icon: "🎯", title: "TCF/TEF Focused", desc: "Exam-frequency vocabulary" },
            { icon: "🔊", title: "Pronunciation", desc: "Listen to native French audio" },
            { icon: "🔑", title: "BYOK", desc: "Bring your own API key" },
            { icon: "📱", title: "Mobile Ready", desc: "PWA — install on your phone" },
            { icon: "🌐", title: "Trilingual", desc: "English + ਪੰਜਾਬੀ + हिन्दी" },
            { icon: "🆓", title: "Free to Start", desc: "No credit card needed" },
          ].map((f) => (
            <div key={f.title} className="bg-brand-surface border border-brand-border rounded-xl p-4 hover:border-brand-accent/20 transition-all">
              <div className="text-xl mb-2">{f.icon}</div>
              <div className="font-bold text-xs">{f.title}</div>
              <div className="text-brand-dim text-[10px] mt-0.5">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="relative z-10 max-w-4xl mx-auto px-5 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-black mb-4">
          Ready to conquer French?
        </h2>
        <p className="text-brand-muted mb-8">Join for free. Start studying in 2 minutes.</p>
        <Link
          href="/signup"
          className="inline-block px-10 py-4 rounded-2xl bg-gradient-to-r from-brand-accent to-purple-500 text-white font-bold text-lg glow-accent hover:scale-[1.03] transition-transform"
        >
          Get Started Free →
        </Link>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-brand-border py-8 text-center">
        <p className="text-brand-dim text-xs">
          FrancoPath · Built for TCF & TEF success · AI-powered by Claude
        </p>
      </footer>
    </div>
  );
}
