import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0A0E17",
          surface: "#111827",
          "surface-hover": "#1a2234",
          card: "#151d2e",
          accent: "#6366f1",
          "accent-glow": "rgba(99,102,241,0.25)",
          success: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
          text: "#f1f5f9",
          muted: "#94a3b8",
          dim: "#64748b",
          border: "#1e293b",
          gold: "#fbbf24",
          punjabi: "#f97316",
          hindi: "#ec4899",
        },
      },
      fontFamily: {
        sans: ["Outfit", "Noto Sans Devanagari", "Noto Sans Gurmukhi", "sans-serif"],
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out",
        "fade-up-delay": "fadeUp 0.5s ease-out 0.2s both",
        "scale-in": "scaleIn 0.4s ease-out",
        float: "float 6s ease-in-out infinite",
        "pulse-soft": "pulseSoft 2.5s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.9)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        pulseSoft: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
