-- ══════════════════════════════════════════════════════
-- FrancoPath Phase 3: Streak & Polish
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- Streak tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longest_streak INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_study_date DATE;

-- Daily activity log (one row per day studied)
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

ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own daily_activity" ON daily_activity FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_daily_activity_user ON daily_activity(user_id, activity_date DESC);
