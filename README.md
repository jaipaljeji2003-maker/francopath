# 🇫🇷 FrancoPath

**AI-Powered French Learning for TCF & TEF Success**

Built for English, Punjabi, and Hindi speakers. Master French with spaced repetition, AI coaching, and exam-focused vocabulary.

## Features

- 🧠 **SM-2 Spaced Repetition** — Optimized review intervals for long-term memory
- 🤖 **AI Coach** — Claude analyzes your progress and adapts your learning path
- 🎯 **TCF/TEF Focused** — Vocabulary curated for exam success
- 🌐 **Trilingual Support** — Translations in English, ਪੰਜਾਬੀ, and हिन्दी
- 📊 **Placement Test** — Adaptive test to determine your CEFR level (A0→B2)
- 🎓 **Exam Prep Mode** — Unlocks after B2 with drills, writing practice, and mock exams
- 🔑 **BYOK** — Bring your own API key for unlimited AI features

## Contextual Update: Deck Planning (AI proposes, SRS disposes)

FrancoPath now uses a **plan-first** study flow for sessions:

- The AI produces a **Deck Plan strategy** (level band, review/new mix, optional focus tags, rationale).
- Deterministic server logic selects actual cards from the user's SRS data.
- **Due reviews are always prioritized first** and are never skipped.
- AI never picks arbitrary words directly from the full DB.
- Plans are cached in `ai_generated_content` as `content_type = "deck_plan"` (with `word_id = null`) and reused for the same Toronto operational day to reduce API calls.
- If AI output is unavailable/invalid, a deterministic fallback plan is used (70/30 review/new with optional one-level-below support).

This keeps selection transparent, reproducible, and aligned with exam-readiness goals while preserving existing SRS guarantees.

## Tech Stack

- **Frontend:** Next.js 14, Tailwind CSS, Framer Motion
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **AI:** Anthropic Claude API
- **Hosting:** Vercel

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/francopath.git
cd francopath
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Go to **SQL Editor** → paste contents of `supabase/migrations/001_initial_schema.sql` → Run
3. Go to **Settings → API** → copy your keys

### 3. Set Up Google Auth (Optional)

1. In Supabase → **Authentication → Providers → Google**
2. Follow the setup guide to add Google OAuth credentials
3. Set redirect URL to `https://your-app.vercel.app/auth/callback`

### 4. Seed the Word Bank

In Supabase **SQL Editor**, run:

```sql
-- Copy and run the seed script (see scripts section below)
```

Or use the provided seed data in `src/data/seed-words.json`.

### 5. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase and Anthropic keys.

### 6. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 7. Deploy to Vercel

1. Push to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repo
4. Add environment variables in Vercel dashboard
5. Deploy!

## Seeding Words

To populate the word bank, go to Supabase SQL Editor and run:

```sql
INSERT INTO words (french, english, hindi, punjabi, part_of_speech, gender, cefr_level, category, example_sentence, tcf_frequency, tef_frequency, false_friend_warning, notes)
VALUES
('bonjour', 'hello', 'नमस्ते', 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'interjection', NULL, 'A0', 'greetings', 'Bonjour, comment allez-vous ?', 8, 8, NULL, 'Used until evening'),
-- ... (see src/data/seed-words.json for full list)
```

A proper seed script will be added in Phase 2.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Login, Signup, Callback
│   ├── (app)/             # Dashboard, Study, Placement, Settings
│   └── api/               # API routes
├── components/            # React components
├── lib/
│   ├── supabase/          # Supabase client & middleware
│   ├── srs/               # SM-2 spaced repetition algorithm
│   └── ai/                # Claude API integration (Phase 2)
├── types/                 # TypeScript types
└── data/                  # Seed data (words, questions)
```

## Development Phases

- [x] Phase 1: Foundation (Auth, DB, SRS, Core UI)
- [ ] Phase 2: AI Integration (Claude API, mnemonics, progress analysis)
- [ ] Phase 3: Polish (BYOK, PWA, animations, streak tracking)
- [ ] Phase 4: Exam Prep (TCF/TEF drills, writing grading, mock exams)
- [ ] Phase 5: Growth (community, listening, speaking)

## License

MIT
