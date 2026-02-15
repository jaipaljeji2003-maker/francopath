-- ══════════════════════════════════════════════════════
-- FrancoPath Phase 2: AI Integration Tables
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- AI generated content cache (prevents duplicate API calls)
CREATE TABLE IF NOT EXISTS ai_generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,         -- 'mnemonic', 'progress_analysis', 'session_plan', 'placement_analysis'
  word_id UUID REFERENCES words(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_cache_lookup ON ai_generated_content(user_id, content_type, word_id);

ALTER TABLE ai_generated_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own ai_content" ON ai_generated_content FOR ALL USING (auth.uid() = user_id);

-- Add session_plans_used column to ai_usage if not exists
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS session_plans_used INT DEFAULT 0;
