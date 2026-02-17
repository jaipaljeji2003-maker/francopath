ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS session_limit INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_daily_goal_range_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_daily_goal_range_check
      CHECK (daily_goal >= 5 AND daily_goal <= 100) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_session_limit_range_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_session_limit_range_check
      CHECK (session_limit IS NULL OR (session_limit >= 5 AND session_limit <= 100) OR session_limit = 999) NOT VALID;
  END IF;
END $$;
