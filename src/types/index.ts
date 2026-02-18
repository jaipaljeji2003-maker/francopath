export type CEFRLevel = "A0" | "A1" | "A2" | "B1" | "B2";
export type TranslationLang = "en" | "hi" | "pa";
export type ExamType = "TCF" | "TEF";
export type CardStatus = "new" | "learning" | "review" | "mastered" | "burned" | "suspended";

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  native_languages: string[];
  preferred_translation: TranslationLang;
  current_level: CEFRLevel;
  target_level: CEFRLevel;
  target_exam: ExamType;
  target_exam_date: string | null;
  daily_goal: number;
  daily_new_words: number;
  session_limit: number | null;
  timezone: string;
  onboarding_complete: boolean;
  exam_prep_unlocked: boolean;
  created_at: string;
}

export interface Word {
  id: string;
  french: string;
  english: string;
  hindi: string | null;
  punjabi: string | null;
  part_of_speech: string | null;
  gender: string | null;
  cefr_level: CEFRLevel;
  category: string;
  subcategory: string | null;
  example_sentence: string | null;
  example_translation_en: string | null;
  example_translation_hi: string | null;
  example_translation_pa: string | null;
  audio_url: string | null;
  tcf_frequency: number;
  tef_frequency: number;
  false_friend_warning: string | null;
  notes: string | null;
}

export interface UserCard {
  id: string;
  user_id: string;
  word_id: string;
  ease_factor: number;
  interval_days: number;
  repetition: number;
  next_review: string;
  last_review: string | null;
  times_seen: number;
  times_correct: number;
  times_wrong: number;
  status: CardStatus;
  ai_mnemonic: string | null;
  word?: Word; // joined
}

export interface StudySession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  cards_reviewed: number;
  cards_correct: number;
  new_cards_seen: number;
  duration_seconds: number | null;
  session_type: string;
  ai_summary: string | null;
}

export interface PlacementResult {
  id: string;
  user_id: string;
  score: number;
  total_questions: number;
  determined_level: CEFRLevel;
  answers: PlacementAnswer[];
  ai_analysis: string | null;
  taken_at: string;
}

export interface PlacementAnswer {
  question_index: number;
  selected: number;
  correct: boolean;
  time_ms: number;
}

export interface PlacementQuestion {
  question: string;
  options: string[];
  correct_index: number;
  level: CEFRLevel;
}

export interface DashboardStats {
  dueCount: number;
  queuedCount: number;
  masteredCount: number;
  totalCards: number;
  accuracy: number;
  streak: number;
  todayReviewed: number;
}

export interface AICoachInsight {
  suggestions: string[];
  canAdvance: boolean;
  focusAreas: string[];
  weeklyTip: string;
}
