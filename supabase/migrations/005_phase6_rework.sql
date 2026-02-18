-- ══════════════════════════════════════════════════════
-- FrancoPath Migration: Phase 6 Rework
-- Adds: burned card status, ai_generated_content table
-- ══════════════════════════════════════════════════════

-- AI Generated Content cache (if not exists from earlier migration)
CREATE TABLE IF NOT EXISTS ai_generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  word_id UUID REFERENCES words(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_content_lookup ON ai_generated_content(user_id, content_type, word_id);

-- Enable RLS
ALTER TABLE ai_generated_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ai content" ON ai_generated_content FOR ALL USING (auth.uid() = user_id);

-- Daily activity table (if not exists)
CREATE TABLE IF NOT EXISTS daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  cards_reviewed INT DEFAULT 0,
  cards_correct INT DEFAULT 0,
  new_cards_seen INT DEFAULT 0,
  study_minutes INT DEFAULT 0,
  sessions_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, activity_date)
);

-- Ensure correct columns exist (handles schema differences between migration versions)
DO $$
BEGIN
  -- If old column name exists, rename it; otherwise add the correct column
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_activity' AND column_name = 'time_spent_seconds') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_activity' AND column_name = 'study_minutes') THEN
      ALTER TABLE daily_activity RENAME COLUMN time_spent_seconds TO study_minutes;
    ELSE
      ALTER TABLE daily_activity DROP COLUMN time_spent_seconds;
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_activity' AND column_name = 'study_minutes') THEN
    ALTER TABLE daily_activity ADD COLUMN study_minutes INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_activity' AND column_name = 'sessions_count') THEN
    ALTER TABLE daily_activity ADD COLUMN sessions_count INT DEFAULT 0;
  END IF;
END $$;

ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own activity" ON daily_activity FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add streak columns to profiles if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'current_streak') THEN
    ALTER TABLE profiles ADD COLUMN current_streak INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'longest_streak') THEN
    ALTER TABLE profiles ADD COLUMN longest_streak INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_study_date') THEN
    ALTER TABLE profiles ADD COLUMN last_study_date DATE;
  END IF;
END $$;

-- Note: "burned" status is just a value in user_cards.status TEXT field
-- No schema change needed — the column already accepts any text value
-- Burned cards: status = 'burned', excluded from study queries

-- Add example translation columns for Hindi/Punjabi (if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'words' AND column_name = 'example_translation_hi') THEN
    ALTER TABLE words ADD COLUMN example_translation_hi TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'words' AND column_name = 'example_translation_pa') THEN
    ALTER TABLE words ADD COLUMN example_translation_pa TEXT;
  END IF;
END $$;
