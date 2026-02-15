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
