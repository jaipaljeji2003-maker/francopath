/**
 * FrancoPath AI Prompt Templates
 * All Claude API prompts centralized here
 */

export const SYSTEM_PROMPT = `You are an expert French language tutor specializing in TCF/TEF exam preparation. You work with students who speak English, Punjabi (ਪੰਜਾਬੀ), and Hindi (हिन्दी). You leverage cross-linguistic connections to help students memorize French vocabulary more effectively. You are encouraging, precise, and exam-focused. Always respond in valid JSON.`;

/**
 * Generate a personalized mnemonic for a French word
 * Uses Hindi/Punjabi sound bridges when possible
 */
export function mnemonicPrompt(params: {
  french: string;
  english: string;
  hindi?: string | null;
  punjabi?: string | null;
  partOfSpeech?: string | null;
  level: string;
  nativeLanguages: string[];
  example?: string | null;
}) {
  const langContext = [];
  if (params.nativeLanguages.includes("pa") && params.punjabi) {
    langContext.push(`Punjabi: ${params.punjabi}`);
  }
  if (params.nativeLanguages.includes("hi") && params.hindi) {
    langContext.push(`Hindi: ${params.hindi}`);
  }

  return `Create a memorable mnemonic for this French word:

French: "${params.french}" (${params.partOfSpeech || "word"})
English: "${params.english}"
${langContext.length > 0 ? `Student also speaks: ${langContext.join(", ")}` : ""}
CEFR Level: ${params.level}
${params.example ? `Example: "${params.example}"` : ""}

Rules:
- If the French word SOUNDS like a Punjabi or Hindi word, create a sound bridge (e.g., "penser" sounds like ਪੈਸੇ/paise)
- Make it vivid, funny, or emotional — these stick in memory
- Keep it to 1-2 sentences maximum
- Include which language the bridge uses

Respond ONLY with this JSON (no markdown, no backticks):
{"mnemonic": "your mnemonic here", "bridge_language": "punjabi|hindi|english|none", "sound_bridge": "the connecting word if any"}`;
}

/**
 * Analyze placement test results
 */
export function placementAnalysisPrompt(params: {
  score: number;
  total: number;
  answers: Array<{ question_index: number; correct: boolean; time_ms: number }>;
  nativeLanguages: string[];
  determinedLevel: string;
}) {
  return `Analyze this French placement test result:

Score: ${params.score}/${params.total} (${Math.round((params.score / params.total) * 100)}%)
Determined Level: ${params.determinedLevel}
Native Languages: ${params.nativeLanguages.join(", ")}

Question Results (index, correct, response_time_ms):
${params.answers.map((a) => `Q${a.question_index + 1}: ${a.correct ? "✓" : "✗"} (${a.time_ms}ms)`).join("\n")}

Questions cover: A0 basics (Q1-3), A1 grammar (Q4-6), A2 connectors (Q7-9), B1 false friends (Q10-12), B2 subjunctive (Q13-15)

Provide a brief analysis:

Respond ONLY with this JSON (no markdown, no backticks):
{
  "level_confidence": 85,
  "strengths": ["area1", "area2"],
  "weaknesses": ["area1", "area2"],
  "first_week_focus": "what to study first",
  "encouragement": "personalized encouraging message"
}`;
}

/**
 * Weekly progress analysis
 */
export function progressAnalysisPrompt(params: {
  name: string;
  level: string;
  targetExam: string;
  examDate?: string | null;
  nativeLanguages: string[];
  totalReviewed: number;
  accuracy: number;
  newWordsLearned: number;
  streak: number;
  weakCategories: string[];
  strongCategories: string[];
  masteredCount: number;
  totalCards: number;
}) {
  return `Analyze this French learner's weekly progress:

Student: ${params.name}
Languages: ${params.nativeLanguages.join(", ")}
Level: ${params.level} → Target: B2 (${params.targetExam})
${params.examDate ? `Exam date: ${params.examDate}` : "No exam date set"}

This week:
- Cards reviewed: ${params.totalReviewed}
- Accuracy: ${params.accuracy}%
- New words learned: ${params.newWordsLearned}
- Study streak: ${params.streak} days
- Mastered: ${params.masteredCount}/${params.totalCards} total cards
- Weak categories: ${params.weakCategories.join(", ") || "none identified yet"}
- Strong categories: ${params.strongCategories.join(", ") || "none yet"}

Respond ONLY with this JSON (no markdown, no backticks):
{
  "summary": "2-3 sentence progress summary",
  "can_advance": false,
  "advance_reason": "why or why not ready for next level",
  "focus_areas": ["area1", "area2", "area3"],
  "tcf_tip": "exam-specific advice for their level",
  "motivation": "encouraging message, include a Punjabi or Hindi phrase if they speak it",
  "predicted_readiness_pct": 65,
  "weekly_goal": "specific actionable goal for next week"
}`;
}

/**
 * Session planning — decide optimal card mix
 */
export function sessionPlanPrompt(params: {
  level: string;
  accuracy: number;
  dueCount: number;
  newCount: number;
  weakCategories: string[];
  sessionNumber: number;
  dailyGoal: number;
}) {
  return `Plan an optimal study session for this French learner:

Level: ${params.level}
Overall accuracy: ${params.accuracy}%
Cards due for review: ${params.dueCount}
New cards available: ${params.newCount}
Weak categories: ${params.weakCategories.join(", ") || "none"}
Session # today: ${params.sessionNumber}
Daily goal: ${params.dailyGoal} cards

Respond ONLY with this JSON (no markdown, no backticks):
{
  "review_cards": 7,
  "new_cards": 3,
  "focus_category": "category to prioritize or null",
  "session_tip": "brief tip for this session",
  "difficulty_adjustment": "normal|easier|harder"
}`;
}

/**
 * Generate contextual example sentences
 */
export function exampleSentencePrompt(params: {
  french: string;
  english: string;
  level: string;
  category: string;
}) {
  return `Generate 2 example sentences using the French word "${params.french}" (${params.english}).

Level: ${params.level}
Category: ${params.category}

Rules:
- Sentences must be appropriate for ${params.level} level
- One everyday context, one TCF/TEF exam-like context
- Include English translations

Respond ONLY with this JSON (no markdown, no backticks):
{
  "everyday": {"french": "...", "english": "..."},
  "exam_style": {"french": "...", "english": "..."}
}`;
}

// ═══════════════════════════════════════════════════
// PHASE 4: EXAM PREP PROMPTS
// ═══════════════════════════════════════════════════

/**
 * Generate TCF/TEF comprehension drill
 */
export function comprehensionDrillPrompt(params: {
  examType: "TCF" | "TEF";
  level: string;
  category: string;
  nativeLanguages: string[];
}) {
  return `Generate a ${params.examType} ${params.category} comprehension exercise at CEFR ${params.level} level.

The student speaks: ${params.nativeLanguages.join(", ")}

Create a realistic exam-style passage with questions.

Rules:
- Passage should be 60-120 words for B1, 100-180 words for B2
- Include 4 multiple-choice questions with 4 options each
- Questions should test: main idea, specific detail, inference, vocabulary in context
- Match the style and difficulty of real ${params.examType} exams
- Include tricky distractors that mirror real exam traps

Respond ONLY with this JSON (no markdown, no backticks):
{
  "passage": "French text here",
  "passage_translation": "English translation",
  "questions": [
    {
      "question": "French question",
      "question_en": "English translation of question",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "Why this is correct (bilingual)"
    }
  ],
  "exam_tip": "Brief exam strategy tip for this type of question"
}`;
}

/**
 * Generate writing practice prompt
 */
export function writingPrompt(params: {
  examType: "TCF" | "TEF";
  level: string;
  taskType: "formal_letter" | "opinion_essay" | "report" | "complaint";
}) {
  const taskDescriptions: Record<string, string> = {
    formal_letter: "Write a formal letter (150-200 words). Context: responding to a job posting, requesting information, or making a formal complaint.",
    opinion_essay: "Write an opinion essay (200-250 words). Take a clear position and support it with arguments.",
    report: "Write a report (150-200 words). Summarize data or describe a situation with recommendations.",
    complaint: "Write a formal complaint letter (150-200 words). Describe the problem and request a specific resolution.",
  };

  return `Generate a ${params.examType} writing task (Expression écrite) at CEFR ${params.level} level.

Task type: ${params.taskType}
Description: ${taskDescriptions[params.taskType]}

Create a realistic exam prompt that a student would need to respond to.

Respond ONLY with this JSON (no markdown, no backticks):
{
  "task_title": "Brief title",
  "scenario": "The exam scenario/prompt in French (2-4 sentences)",
  "scenario_en": "English translation",
  "requirements": ["requirement 1", "requirement 2", "requirement 3"],
  "requirements_en": ["English requirement 1", "English requirement 2"],
  "word_count_min": 150,
  "word_count_max": 200,
  "time_limit_minutes": 30,
  "grading_criteria": ["criterion 1", "criterion 2", "criterion 3", "criterion 4"],
  "useful_vocabulary": ["word1", "word2", "word3", "word4", "word5"],
  "useful_expressions": ["expression1", "expression2", "expression3"]
}`;
}

/**
 * Grade a writing submission
 */
export function writingGradePrompt(params: {
  examType: "TCF" | "TEF";
  level: string;
  task: string;
  submission: string;
  nativeLanguages: string[];
}) {
  return `Grade this ${params.examType} writing submission at CEFR ${params.level} level.

Task: ${params.task}

Student's submission:
"""
${params.submission}
"""

Student speaks: ${params.nativeLanguages.join(", ")}

Grade on TCF/TEF criteria:

Respond ONLY with this JSON (no markdown, no backticks):
{
  "overall_score": 14,
  "max_score": 20,
  "band": "B1+",
  "criteria_scores": {
    "task_completion": {"score": 4, "max": 5, "comment": "..."},
    "coherence": {"score": 3, "max": 5, "comment": "..."},
    "vocabulary": {"score": 4, "max": 5, "comment": "..."},
    "grammar": {"score": 3, "max": 5, "comment": "..."}
  },
  "strengths": ["strength 1", "strength 2"],
  "errors": [
    {"original": "error text", "correction": "corrected text", "rule": "grammar rule"}
  ],
  "improved_version": "A model answer showing improvements",
  "study_tips": ["tip for improvement 1", "tip 2"],
  "native_language_tip": "Tip leveraging their Hindi/Punjabi knowledge"
}`;
}

/**
 * Generate vocabulary-in-context drill (common TCF/TEF format)
 */
export function vocabDrillPrompt(params: {
  examType: "TCF" | "TEF";
  level: string;
  focusArea: string;
}) {
  return `Generate a ${params.examType} vocabulary-in-context drill at CEFR ${params.level} level.
Focus area: ${params.focusArea}

Create 5 fill-in-the-blank sentences where the student must choose the correct word.

Respond ONLY with this JSON (no markdown, no backticks):
{
  "focus": "${params.focusArea}",
  "questions": [
    {
      "sentence": "French sentence with _____ blank",
      "sentence_en": "English translation",
      "options": ["word1", "word2", "word3", "word4"],
      "correct_index": 0,
      "explanation": "Why this word fits (brief)"
    }
  ],
  "exam_tip": "Strategy for vocabulary-in-context questions"
}`;
}

/**
 * Mock exam score prediction
 */
export function scorePredictionPrompt(params: {
  examType: "TCF" | "TEF";
  drillHistory: Array<{ type: string; score: number; maxScore: number }>;
  accuracy: number;
  level: string;
  masteredWords: number;
  totalWords: number;
  weakAreas: string[];
}) {
  return `Predict this student's ${params.examType} exam performance.

Current level: ${params.level}
Overall accuracy: ${params.accuracy}%
Vocabulary mastered: ${params.masteredWords}/${params.totalWords}
Weak areas: ${params.weakAreas.join(", ") || "none identified"}

Drill history:
${params.drillHistory.map(d => `  ${d.type}: ${d.score}/${d.maxScore}`).join("\n")}

Respond ONLY with this JSON (no markdown, no backticks):
{
  "predicted_level": "B1",
  "predicted_score_range": "350-400",
  "confidence": 72,
  "section_predictions": {
    "comprehension_orale": {"predicted": "B1", "readiness_pct": 65},
    "comprehension_ecrite": {"predicted": "B1+", "readiness_pct": 70},
    "expression_ecrite": {"predicted": "A2+", "readiness_pct": 55},
    "expression_orale": {"predicted": "A2", "readiness_pct": 45}
  },
  "days_to_ready": 45,
  "priority_actions": ["action 1", "action 2", "action 3"],
  "encouragement": "Motivating message with timeline estimate"
}`;
}
