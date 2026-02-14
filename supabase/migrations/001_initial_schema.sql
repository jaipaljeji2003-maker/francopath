-- ══════════════════════════════════════════════════════
-- FrancoPath Database Schema v1.0
-- Run this in Supabase SQL Editor (supabase.com → SQL)
-- ══════════════════════════════════════════════════════

-- ─── PROFILES ───
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  native_languages TEXT[] DEFAULT '{"en"}',
  preferred_translation TEXT DEFAULT 'en',
  current_level TEXT DEFAULT 'A0',
  target_level TEXT DEFAULT 'B2',
  target_exam TEXT DEFAULT 'TCF',
  target_exam_date DATE,
  daily_goal INT DEFAULT 10,
  timezone TEXT DEFAULT 'America/Toronto',
  onboarding_complete BOOLEAN DEFAULT FALSE,
  -- Exam prep
  exam_prep_unlocked BOOLEAN DEFAULT FALSE,
  exam_prep_unlocked_at TIMESTAMPTZ,
  -- BYOK
  byok_encrypted_key TEXT,
  byok_key_added_at TIMESTAMPTZ,
  byok_key_valid BOOLEAN DEFAULT FALSE,
  byok_provider TEXT DEFAULT 'anthropic',
  ai_tier TEXT DEFAULT 'free',
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── WORDS (Master Vocabulary Bank) ───
CREATE TABLE words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  french TEXT NOT NULL,
  english TEXT NOT NULL,
  hindi TEXT,
  punjabi TEXT,
  part_of_speech TEXT,
  gender TEXT,
  cefr_level TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  example_sentence TEXT,
  example_translation_en TEXT,
  example_translation_hi TEXT,
  example_translation_pa TEXT,
  audio_url TEXT,
  image_url TEXT,
  tcf_frequency INT DEFAULT 0,
  tef_frequency INT DEFAULT 0,
  conjugation JSONB,
  notes TEXT,
  false_friend_warning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_words_level ON words(cefr_level);
CREATE INDEX idx_words_category ON words(category);

-- ─── USER CARDS (SRS State) ───
CREATE TABLE user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  word_id UUID REFERENCES words(id) ON DELETE CASCADE,
  ease_factor REAL DEFAULT 2.5,
  interval_days INT DEFAULT 0,
  repetition INT DEFAULT 0,
  next_review TIMESTAMPTZ DEFAULT NOW(),
  last_review TIMESTAMPTZ,
  times_seen INT DEFAULT 0,
  times_correct INT DEFAULT 0,
  times_wrong INT DEFAULT 0,
  average_response_time_ms INT,
  status TEXT DEFAULT 'new',
  ai_difficulty_rating REAL,
  ai_mnemonic TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word_id)
);

CREATE INDEX idx_user_cards_review ON user_cards(user_id, next_review);
CREATE INDEX idx_user_cards_status ON user_cards(user_id, status);

-- ─── STUDY SESSIONS ───
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  cards_reviewed INT DEFAULT 0,
  cards_correct INT DEFAULT 0,
  new_cards_seen INT DEFAULT 0,
  duration_seconds INT,
  session_type TEXT DEFAULT 'review',
  ai_summary TEXT,
  ai_recommendations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CARD REVIEWS ───
CREATE TABLE card_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_card_id UUID REFERENCES user_cards(id) ON DELETE CASCADE,
  session_id UUID REFERENCES study_sessions(id) ON DELETE SET NULL,
  quality INT NOT NULL,
  response_time_ms INT,
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_card_reviews_user ON card_reviews(user_id, reviewed_at DESC);

-- ─── PLACEMENT RESULTS ───
CREATE TABLE placement_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  score INT NOT NULL,
  total_questions INT NOT NULL,
  determined_level TEXT NOT NULL,
  answers JSONB NOT NULL,
  ai_analysis TEXT,
  taken_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AI USAGE TRACKING ───
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mnemonics_used INT DEFAULT 0,
  drills_used INT DEFAULT 0,
  writing_grades_used INT DEFAULT 0,
  mock_exams_used INT DEFAULT 0,
  analyses_used INT DEFAULT 0,
  total_tokens_used INT DEFAULT 0,
  UNIQUE(user_id, usage_date)
);

-- ─── AI PROGRESS SNAPSHOTS ───
CREATE TABLE ai_progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  current_level TEXT NOT NULL,
  overall_accuracy REAL,
  words_mastered INT,
  words_learning INT,
  words_new INT,
  streak_days INT,
  weak_categories TEXT[],
  strong_categories TEXT[],
  ai_assessment TEXT,
  readiness_score REAL,
  estimated_exam_readiness TEXT,
  recommendations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

-- ─── EXAM PREP TABLES ───
CREATE TABLE exam_vocab (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  french TEXT NOT NULL,
  english TEXT NOT NULL,
  hindi TEXT,
  punjabi TEXT,
  part_of_speech TEXT,
  exam_section TEXT NOT NULL,
  exam_frequency INT DEFAULT 5,
  example_exam_context TEXT,
  trap_note TEXT,
  formal_register_note TEXT,
  generated_by_ai BOOLEAN DEFAULT TRUE,
  ease_factor REAL DEFAULT 2.5,
  interval_days INT DEFAULT 0,
  repetition INT DEFAULT 0,
  next_review TIMESTAMPTZ DEFAULT NOW(),
  times_seen INT DEFAULT 0,
  times_correct INT DEFAULT 0,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exam_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  drill_type TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  questions JSONB NOT NULL,
  answers JSONB,
  score REAL,
  max_score REAL,
  time_taken_seconds INT,
  time_limit_seconds INT,
  ai_feedback TEXT,
  ai_grading JSONB,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE mock_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  exam_type TEXT NOT NULL,
  sections JSONB NOT NULL,
  total_score REAL,
  predicted_level TEXT,
  predicted_score_range TEXT,
  ai_analysis TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ══════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_progress_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_vocab ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_exams ENABLE ROW LEVEL SECURITY;

-- Words are public (read-only for authenticated)
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read words" ON words FOR SELECT USING (true);

-- All user tables: users can only access their own data
CREATE POLICY "Users manage own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own cards" ON user_cards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own sessions" ON study_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own reviews" ON card_reviews FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own placement" ON placement_results FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own ai_usage" ON ai_usage FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own snapshots" ON ai_progress_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own exam_vocab" ON exam_vocab FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own drills" ON exam_drills FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own mocks" ON mock_exams FOR ALL USING (auth.uid() = user_id);

-- ─── HELPER FUNCTION: Increment AI usage ───
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id UUID,
  p_feature TEXT,
  p_tokens INT DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO ai_usage (user_id, usage_date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  EXECUTE format(
    'UPDATE ai_usage SET %I = %I + 1, total_tokens_used = total_tokens_used + $1 WHERE user_id = $2 AND usage_date = CURRENT_DATE',
    p_feature, p_feature
  ) USING p_tokens, p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
