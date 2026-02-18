-- Migration 007: Add daily_new_words preference to profiles
-- Part of SRS rework: users choose how many new words to add per session

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'daily_new_words'
  ) THEN
    ALTER TABLE profiles ADD COLUMN daily_new_words INT DEFAULT 5;
  END IF;
END $$;
