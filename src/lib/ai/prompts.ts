/**
 * FrancoPath AI Prompt Templates (Reworked)
 * - Fixed multilingual mnemonic generation (Hindi/Punjabi bridges actually work)
 * - TCF/TEF specific writing tasks (Task 1/2/3)
 * - Mastery verification test
 * - Honest score prediction
 * - Adaptive AI engine
 */

export const SYSTEM_PROMPT = `You are an expert French language tutor specializing in TCF Canada and TEF Canada exam preparation. You work with students who speak English, Punjabi (ਪੰਜਾਬੀ), and Hindi (हिन्दी).

KEY RULES:
- You leverage cross-linguistic sound bridges between French and Hindi/Punjabi to create memorable mnemonics
- You understand the exact structure of TCF Canada and TEF Canada exams
- You are encouraging but HONEST — never fabricate data or confidence levels
- Always respond in valid JSON only — no markdown, no backticks, no extra text`;

/**
 * FIXED: Multilingual mnemonic generation
 * Now explicitly instructs to generate in the user's PREFERRED language, not just English
 */
export function mnemonicPrompt(params: {
  french: string;
  english: string;
  hindi?: string | null;
  punjabi?: string | null;
  partOfSpeech?: string | null;
  level: string;
  preferredLanguage: "en" | "hi" | "pa";
  example?: string | null;
}) {
  const langInstructions = {
    pa: `The student's PRIMARY language is Punjabi (ਪੰਜਾਬੀ).
CRITICAL: Create the mnemonic primarily in PUNJABI SCRIPT (Gurmukhi). The mnemonic story/sentence should be written in ਪੰਜਾਬੀ.
The Punjabi translation of "${params.french}" is: "${params.punjabi || "unknown"}"
- Find sound similarities between the French word and Punjabi words
- Example: "penser" (to think) → "ਪੈਸੇ (paise/money) ਬਾਰੇ ਸੋਚੋ - ਪੈਸੇ ਬਾਰੇ penser ਕਰੋ!"
- Write the mnemonic in Gurmukhi script with French words mixed in
- The bridge should feel natural to a Punjabi speaker`,

    hi: `The student's PRIMARY language is Hindi (हिन्दी).
CRITICAL: Create the mnemonic primarily in HINDI SCRIPT (Devanagari). The mnemonic story/sentence should be written in हिन्दी.
The Hindi translation of "${params.french}" is: "${params.hindi || "unknown"}"
- Find sound similarities between the French word and Hindi words
- Example: "rue" (street) → "रू (roo) - गली में रूमाल गिरा, rue में रूमाल!"
- Write the mnemonic in Devanagari script with French words mixed in
- The bridge should feel natural to a Hindi speaker`,

    en: `The student's primary language is English.
Create the mnemonic in English, but if the student also speaks Punjabi or Hindi, try to incorporate sound bridges from those languages too.
${params.punjabi ? `Punjabi: ${params.punjabi}` : ""}
${params.hindi ? `Hindi: ${params.hindi}` : ""}`,
  };

  return `Create a memorable mnemonic for this French word:

French: "${params.french}" (${params.partOfSpeech || "word"})
English: "${params.english}"
CEFR Level: ${params.level}
${params.example ? `Example: "${params.example}"` : ""}

${langInstructions[params.preferredLanguage]}

Rules:
- The mnemonic MUST be in the student's preferred language script (not English unless they chose English)
- Find SOUND similarities between French pronunciation and ${params.preferredLanguage === "pa" ? "Punjabi" : params.preferredLanguage === "hi" ? "Hindi" : "English"} words
- Make it vivid, funny, or emotional — these stick in memory
- Keep it to 1-2 sentences maximum
- If no good sound bridge exists, create a vivid visual association instead

Respond ONLY with this JSON:
{"mnemonic": "your mnemonic here IN THE CORRECT SCRIPT", "bridge_language": "punjabi|hindi|english", "sound_bridge": "the connecting word/sound if any"}`;
}

/**
 * AI-generated placement test questions
 * Generates fresh questions each time with rotation
 */
export function placementTestPrompt(params: {
  previousQuestionIds?: string[];
}) {
  return `Generate 15 fresh French placement test questions across CEFR levels A0 to B2.

Structure: 3 questions per level (A0, A1, A2, B1, B2)
Each question must be DIFFERENT from standard textbook questions — be creative.

${params.previousQuestionIds?.length ? `IMPORTANT: These question IDs were used before, generate completely different questions: ${params.previousQuestionIds.join(", ")}` : ""}

Question types to mix:
- A0: Basic greetings, numbers, simple nouns, gender
- A1: Present tense conjugation, articles, basic prepositions, negation
- A2: Past tense (passé composé vs imparfait), connectors, daily situations
- B1: Subjunctive triggers, false friends, formal/informal register, complex connectors
- B2: Nuanced vocabulary, idiomatic expressions, advanced grammar, text analysis

Rules:
- 4 options per question, exactly 1 correct
- Include tricky distractors that test real understanding
- Questions should progress in difficulty
- Vary question formats (fill-blank, meaning, grammar, usage)

Respond ONLY with this JSON:
[
  {
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "correct_index": 0,
    "level": "A0",
    "skill_tested": "vocabulary|grammar|comprehension|usage"
  }
]`;
}

/**
 * Placement analysis
 */
export function placementAnalysisPrompt(params: {
  score: number;
  total: number;
  answers: Array<{ question_index: number; correct: boolean; time_ms: number; level: string; skill_tested: string }>;
  nativeLanguages: string[];
  determinedLevel: string;
}) {
  return `Analyze this French placement test result:

Score: ${params.score}/${params.total} (${Math.round((params.score / params.total) * 100)}%)
Determined Level: ${params.determinedLevel}
Native Languages: ${params.nativeLanguages.join(", ")}

Results by level:
${params.answers.map((a) => `Q${a.question_index + 1} [${a.level}/${a.skill_tested}]: ${a.correct ? "✓" : "✗"} (${a.time_ms}ms)`).join("\n")}

Respond ONLY with this JSON:
{
  "level_confidence": 85,
  "strengths": ["area1", "area2"],
  "weaknesses": ["area1", "area2"],
  "first_week_focus": "what to study first",
  "encouragement": "personalized encouraging message"
}`;
}

/**
 * Progress analysis
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
  return `Analyze this French learner's progress:

Student: ${params.name}
Languages: ${params.nativeLanguages.join(", ")}
Level: ${params.level} → Target: ${params.targetExam} Canada
${params.examDate ? `Exam date: ${params.examDate}` : "No exam date set"}

Stats:
- Cards reviewed: ${params.totalReviewed}
- Accuracy: ${params.accuracy}%
- New words learned: ${params.newWordsLearned}
- Study streak: ${params.streak} days
- Mastered: ${params.masteredCount}/${params.totalCards} total cards
- Weak categories: ${params.weakCategories.join(", ") || "none identified yet"}
- Strong categories: ${params.strongCategories.join(", ") || "none yet"}

Respond ONLY with this JSON:
{
  "summary": "2-3 sentence progress summary",
  "can_advance": false,
  "advance_reason": "why or why not ready for next level",
  "focus_areas": ["area1", "area2", "area3"],
  "tcf_tip": "exam-specific advice for their level",
  "motivation": "encouraging message — include a Punjabi or Hindi phrase if they speak it",
  "predicted_readiness_pct": 65,
  "weekly_goal": "specific actionable goal"
}`;
}

/**
 * Session planning
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
  return `Plan an optimal study session:

Level: ${params.level}
Accuracy: ${params.accuracy}%
Due cards: ${params.dueCount}
New cards available: ${params.newCount}
Weak categories: ${params.weakCategories.join(", ") || "none"}
Session #: ${params.sessionNumber}
Daily goal: ${params.dailyGoal} cards

Respond ONLY with this JSON:
{
  "review_cards": 7,
  "new_cards": 3,
  "focus_category": "category to prioritize or null",
  "session_tip": "brief tip",
  "difficulty_adjustment": "normal|easier|harder"
}`;
}

// ═══════════════════════════════════════════════════
// WRITING PRACTICE — TCF/TEF TASK STRUCTURE
// ═══════════════════════════════════════════════════

/**
 * TCF Canada / TEF Canada writing task generator
 * Now supports all levels with specific task types per exam
 */
export function writingTaskPrompt(params: {
  examType: "TCF" | "TEF";
  level: string;
  taskNumber: 1 | 2 | 3;
  questionType?: string;
  recentVocab?: string[]; // words user is currently learning
}) {
  const tcfTasks: Record<number, { name: string; description: string; wordRange: string; levels: string }> = {
    1: {
      name: "Tâche 1 — Short Message",
      description: "Write a short message, note, or informal communication (email to a friend, post-it note, SMS reply, forum comment). Simple everyday scenario.",
      wordRange: "60-120 words",
      levels: "A1-A2",
    },
    2: {
      name: "Tâche 2 — Article/Letter/Post",
      description: "Write an article, semi-formal letter, blog post, or forum contribution. Must describe, narrate, or explain a situation with some personal opinion.",
      wordRange: "120-180 words",
      levels: "A2-B1",
    },
    3: {
      name: "Tâche 3 — Argumentative Essay",
      description: "Write an essay comparing viewpoints, defending a position, or analyzing a societal issue. Must present arguments and counter-arguments with nuance.",
      wordRange: "180-250 words",
      levels: "B1-B2",
    },
  };

  const tefTasks: Record<number, { name: string; description: string; wordRange: string; levels: string }> = {
    1: {
      name: "Section A — News Summary",
      description: "Summarize a news article or report. Must extract key information and reorganize it concisely. Tests comprehension and synthesis skills.",
      wordRange: "80-100 words",
      levels: "A2-B1",
    },
    2: {
      name: "Section B — Argumentative Text",
      description: "Write a persuasive text arguing a position on a contemporary topic. Must include introduction, arguments with examples, and conclusion.",
      wordRange: "200-250 words",
      levels: "B1-B2",
    },
    3: {
      name: "Section B — Formal Letter",
      description: "Write a formal letter (complaint, request, application). Must follow French formal letter conventions with proper salutations and register.",
      wordRange: "150-200 words",
      levels: "A2-B2",
    },
  };

  const tasks = params.examType === "TCF" ? tcfTasks : tefTasks;
  const task = tasks[params.taskNumber];

  const vocabContext = params.recentVocab?.length
    ? `\nIMPORTANT: The student is currently learning these words. Try to create a scenario where they would naturally use some of these: ${params.recentVocab.join(", ")}`
    : "";

  return `Generate a ${params.examType} Canada writing task.

Task: ${task.name}
Description: ${task.description}
Target level: ${params.level} (but task structure is ${task.levels})
Word count: ${task.wordRange}
${params.questionType ? `Specific question type: ${params.questionType}` : ""}
${vocabContext}

Create a realistic exam prompt. Make it interesting and relevant to Canadian French-speaking contexts when possible.

Respond ONLY with this JSON:
{
  "task_title": "Brief title",
  "task_number": ${params.taskNumber},
  "exam_type": "${params.examType}",
  "scenario": "The exam scenario/prompt in French",
  "scenario_en": "English translation",
  "requirements": ["requirement 1", "requirement 2", "requirement 3"],
  "requirements_en": ["English requirement 1", "English requirement 2"],
  "word_count_min": ${parseInt(task.wordRange)},
  "word_count_max": ${parseInt(task.wordRange.split("-")[1])},
  "time_limit_minutes": ${params.taskNumber === 1 ? 15 : params.taskNumber === 2 ? 25 : 35},
  "grading_criteria": ["criterion 1", "criterion 2", "criterion 3"],
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
  taskNumber: number;
  task: string;
  submission: string;
  nativeLanguages: string[];
}) {
  return `Grade this ${params.examType} Canada writing submission (Task ${params.taskNumber}) at CEFR ${params.level} level.

Task: ${params.task}

Student's submission:
"""
${params.submission}
"""

Student speaks: ${params.nativeLanguages.join(", ")}

Grade on official ${params.examType} criteria. Be accurate and constructive.

Respond ONLY with this JSON:
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
    {"original": "error text", "correction": "corrected text", "rule": "grammar rule", "category": "grammar|vocabulary|spelling|syntax"}
  ],
  "improved_version": "A model answer showing improvements",
  "study_tips": ["tip 1", "tip 2"],
  "vocab_to_review": ["French words the student misused or could have used"],
  "native_language_tip": "Tip leveraging their Hindi/Punjabi knowledge"
}`;
}

// ═══════════════════════════════════════════════════
// MASTERY VERIFICATION TEST
// ═══════════════════════════════════════════════════

/**
 * Vocab-in-context mastery test
 * Tests if user truly knows words they've "mastered" in flashcards
 * Failing demotes cards back to learning
 */
export function masteryVerificationPrompt(params: {
  words: Array<{ french: string; english: string; category: string; level: string }>;
  examType: "TCF" | "TEF";
  level: string;
}) {
  const wordList = params.words.map(w => `${w.french} (${w.english})`).join(", ");

  return `Generate a mastery verification test using these specific French words the student claims to know:

Words to test: ${wordList}
Student level: ${params.level}
Target exam: ${params.examType} Canada

Create fill-in-the-blank sentences where ONLY the correct word from the list fits naturally. The student must demonstrate they truly know each word in context, not just recognition.

Rules:
- One question per word (${params.words.length} total)
- Each sentence should use the word in a realistic, exam-relevant context
- Provide 4 options including the correct word and 3 plausible distractors FROM THE SAME LIST or similar words
- The context must test UNDERSTANDING, not just pattern matching
- Include the English translation of each sentence

Respond ONLY with this JSON:
{
  "questions": [
    {
      "word_tested": "French word being tested",
      "sentence": "French sentence with _____ blank",
      "sentence_en": "English translation",
      "options": ["correct_word", "distractor1", "distractor2", "distractor3"],
      "correct_index": 0,
      "explanation": "Brief explanation of why this word fits"
    }
  ],
  "test_tip": "General exam strategy tip"
}`;
}

// ═══════════════════════════════════════════════════
// SCORE PREDICTION (HONEST)
// ═══════════════════════════════════════════════════

/**
 * Honest score prediction — refuses to predict without enough data
 */
export function scorePredictionPrompt(params: {
  examType: "TCF" | "TEF";
  level: string;
  accuracy: number;
  masteredWords: number;
  totalWords: number;
  weakAreas: string[];
  writingHistory: Array<{ taskNumber: number; score: number; maxScore: number }>;
  totalStudyDays: number;
  totalReviews: number;
}) {
  return `Predict this student's ${params.examType} Canada exam performance.

CRITICAL RULE: If you don't have enough data to make a confident prediction for ANY section, say "insufficient_data" for that section. NEVER fabricate confidence or scores. Honesty is more important than completeness.

Current level: ${params.level}
Overall vocabulary accuracy: ${params.accuracy}%
Vocabulary mastered: ${params.masteredWords}/${params.totalWords}
Weak areas: ${params.weakAreas.join(", ") || "none identified"}
Total study days: ${params.totalStudyDays}
Total card reviews: ${params.totalReviews}

Writing practice history:
${params.writingHistory.length > 0
    ? params.writingHistory.map(w => `  Task ${w.taskNumber}: ${w.score}/${w.maxScore}`).join("\n")
    : "  No writing practice completed yet"}

Data sufficiency guidelines:
- Need ≥50 mastered words + ≥10 study days for basic vocabulary prediction
- Need ≥3 writing submissions for writing prediction
- Need ≥100 card reviews for accuracy-based prediction
- If ANY of these thresholds aren't met for a section, use "insufficient_data"

Respond ONLY with this JSON:
{
  "has_enough_data": true,
  "overall_prediction": {
    "predicted_level": "B1",
    "confidence_pct": 65,
    "score_range": "350-400"
  },
  "section_predictions": {
    "comprehension_ecrite": {"predicted": "B1", "readiness_pct": 70, "note": "Based on vocabulary mastery"},
    "expression_ecrite": {"predicted": "insufficient_data", "readiness_pct": 0, "note": "Need more writing practice submissions"},
    "comprehension_orale": {"predicted": "insufficient_data", "readiness_pct": 0, "note": "No listening data available"},
    "expression_orale": {"predicted": "insufficient_data", "readiness_pct": 0, "note": "No speaking data available"}
  },
  "what_to_improve": ["specific action 1", "specific action 2"],
  "data_needed": ["Complete 3+ writing tasks for writing prediction", "Practice listening for oral prediction"],
  "honest_assessment": "Straightforward summary of where the student stands"
}`;
}

// ═══════════════════════════════════════════════════
// ADAPTIVE AI ENGINE
// ═══════════════════════════════════════════════════

/**
 * AI analyzes user data to build personalized vocab deck
 * Uses writing errors, weak categories, and study patterns
 */
export function adaptiveDeckPrompt(params: {
  examType: "TCF" | "TEF";
  level: string;
  weakCategories: string[];
  writingErrors: Array<{ category: string; count: number }>;
  masteredCategories: string[];
  currentVocabCount: number;
  targetLevel: string;
}) {
  return `Analyze this student's learning data and recommend vocabulary focus for ${params.examType} Canada preparation.

Current level: ${params.level} → Target: ${params.targetLevel}
Current vocabulary size: ${params.currentVocabCount} words
Weak categories (low accuracy): ${params.weakCategories.join(", ") || "none"}
Strong/mastered categories: ${params.masteredCategories.join(", ") || "none"}
Writing error patterns: ${params.writingErrors.map(e => `${e.category}: ${e.count} errors`).join(", ") || "no writing data"}

Based on this analysis, recommend:

Respond ONLY with this JSON:
{
  "priority_categories": ["category1", "category2", "category3"],
  "reason": "Why these categories are most important now",
  "vocab_gap_analysis": "What vocabulary gaps exist for their target exam",
  "recommended_daily_new_words": 8,
  "focus_shift_advice": "Should they change study focus? Why?",
  "writing_vocab_focus": ["specific words they should practice in writing"],
  "exam_readiness_gaps": ["specific gaps between current ability and exam requirements"]
}`;
}
