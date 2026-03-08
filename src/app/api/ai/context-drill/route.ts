import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cacheResponse, callClaude, getCachedResponse } from "@/lib/ai/claude";
import { contextDrillPrompt } from "@/lib/ai/prompts";
import { extractWritingFocusSignals } from "@/lib/study/review-focus";

type DrillPayload = {
  exercise_type: "cloze";
  question: string;
  sentence_with_blank: string;
  sentence_en: string;
  options: string[];
  correct_index: number;
  explanation: string;
  exam_value: string;
  coaching_tip: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shuffleOptions(correct: string, distractors: string[]) {
  const options = [correct, ...distractors];
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    options,
    correctIndex: options.indexOf(correct),
  };
}

function buildFallbackDrill(params: {
  french: string;
  english: string;
  category: string;
  exampleSentence?: string | null;
  targetExam: "TCF" | "TEF";
  distractors: string[];
}): DrillPayload {
  const blankSentence =
    params.exampleSentence &&
    new RegExp(`\\b${escapeRegExp(params.french)}\\b`, "i").test(params.exampleSentence)
      ? params.exampleSentence.replace(
          new RegExp(`\\b${escapeRegExp(params.french)}\\b`, "i"),
          "_____"
        )
      : `Pour un exercice de ${params.category}, le mot _____ exprime "${params.english}" dans un contexte utile.`;

  const { options, correctIndex } = shuffleOptions(params.french, params.distractors);

  return {
    exercise_type: "cloze",
    question: "Choose the best word for the blank.",
    sentence_with_blank: blankSentence,
    sentence_en: `Choose the French word that best expresses "${params.english}".`,
    options,
    correct_index: correctIndex,
    explanation: `"${params.french}" is the word that matches the target meaning "${params.english}" in this context.`,
    exam_value: `This word is useful because ${params.targetExam} tasks reward precise vocabulary in context, not just recognition.`,
    coaching_tip: "Say the full sentence aloud once after you answer so the word is tied to a real usage pattern.",
  };
}

function normalizeDrill(
  payload: any,
  correctWord: string,
  distractors: string[],
  fallback: DrillPayload
): DrillPayload {
  if (!payload || typeof payload !== "object") return fallback;

  const providedOptions = Array.isArray(payload.options)
    ? payload.options.filter((option: unknown): option is string => typeof option === "string")
    : [];

  const allOptions = new Set([correctWord, ...distractors]);
  const validProvidedOptions = providedOptions.filter((option: string) => allOptions.has(option));

  const normalizedOptions =
    validProvidedOptions.length === 4 && validProvidedOptions.includes(correctWord)
      ? validProvidedOptions
      : fallback.options;

  const correctIndex = normalizedOptions.indexOf(correctWord);
  if (correctIndex === -1) return fallback;

  return {
    exercise_type: "cloze",
    question:
      typeof payload.question === "string" && payload.question.trim()
        ? payload.question.trim()
        : fallback.question,
    sentence_with_blank:
      typeof payload.sentence_with_blank === "string" && payload.sentence_with_blank.includes("_____")
        ? payload.sentence_with_blank.trim()
        : fallback.sentence_with_blank,
    sentence_en:
      typeof payload.sentence_en === "string" && payload.sentence_en.trim()
        ? payload.sentence_en.trim()
        : fallback.sentence_en,
    options: normalizedOptions,
    correct_index: correctIndex,
    explanation:
      typeof payload.explanation === "string" && payload.explanation.trim()
        ? payload.explanation.trim()
        : fallback.explanation,
    exam_value:
      typeof payload.exam_value === "string" && payload.exam_value.trim()
        ? payload.exam_value.trim()
        : fallback.exam_value,
    coaching_tip:
      typeof payload.coaching_tip === "string" && payload.coaching_tip.trim()
        ? payload.coaching_tip.trim()
        : fallback.coaching_tip,
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    wordId,
    french,
    english,
    category,
    level,
    exampleSentence,
    falseFriendWarning,
  } = await req.json();

  if (!wordId || !french || !english || !category || !level) {
    return NextResponse.json({ error: "wordId, french, english, category, and level are required" }, { status: 400 });
  }

  const cached = await getCachedResponse(user.id, "context_drill", wordId);
  if (cached) {
    try {
      return NextResponse.json({ drill: JSON.parse(cached), cached: true });
    } catch {
      // ignore malformed cache and regenerate
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, target_exam")
    .eq("id", user.id)
    .single();

  const { data: distractorWords } = await supabase
    .from("words")
    .select("french, category, cefr_level, tcf_frequency, tef_frequency")
    .eq("cefr_level", level)
    .eq("category", category)
    .neq("id", wordId)
    .limit(8);

  const distractors = Array.from(
    new Set(
        (distractorWords || [])
          .map((word: any) => word.french)
          .filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
    )
  ).slice(0, 3);

  const fallbackDrill = buildFallbackDrill({
    french,
    english,
    category,
    exampleSentence,
    targetExam: (profile?.target_exam || "TCF") as "TCF" | "TEF",
    distractors: distractors.length === 3 ? distractors : ["preuve", "accord", "outil"].slice(0, 3),
  });

  const { data: recentWritingDrills } = await supabase
    .from("exam_drills")
    .select("ai_grading")
    .eq("user_id", user.id)
    .eq("drill_type", "writing")
    .order("completed_at", { ascending: false })
    .limit(5);

  const writingSignals = extractWritingFocusSignals(
    recentWritingDrills as Array<{ ai_grading: any }> | null
  );

  const prompt = contextDrillPrompt({
    examType: (profile?.target_exam || "TCF") as "TCF" | "TEF",
    level: profile?.current_level || level,
    word: {
      french,
      english,
      category,
      cefr_level: level,
      example_sentence: exampleSentence,
      false_friend_warning: falseFriendWarning,
    },
    distractors: fallbackDrill.options.filter((option) => option !== french),
    writingWeaknesses: writingSignals.weaknessLabels,
  });

  const result = await callClaude({ userId: user.id, prompt, maxTokens: 550 });
  let drill = fallbackDrill;

  if (!result.error) {
    try {
      const parsed = JSON.parse(result.content);
      drill = normalizeDrill(parsed, french, fallbackDrill.options.filter((option) => option !== french), fallbackDrill);
    } catch {
      drill = fallbackDrill;
    }
  }

  await cacheResponse({
    userId: user.id,
    contentType: "context_drill",
    wordId,
    content: JSON.stringify(drill),
    tokensUsed: result.tokensUsed || 0,
  });

  return NextResponse.json({ drill, cached: false });
}
