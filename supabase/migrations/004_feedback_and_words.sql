-- ══════════════════════════════════════════════════════
-- FrancoPath Phase 5: Feedback & Expanded Words
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- User feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL, -- 'bug', 'feature', 'ai_quality', 'word_issue', 'general'
  content TEXT NOT NULL,
  page_url TEXT,
  context JSONB, -- extra data like word_id, drill_id, etc.
  rating INT, -- 1-5 stars for AI quality feedback
  status TEXT DEFAULT 'new', -- 'new', 'reviewed', 'resolved'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users create own feedback" ON user_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own feedback" ON user_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX idx_feedback_user ON user_feedback(user_id, created_at DESC);
