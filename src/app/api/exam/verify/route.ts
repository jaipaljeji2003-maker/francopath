import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import { masteryVerificationPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, target_exam")
    .eq("id", user.id)
    .single();

  // Get "mastered" or high-confidence cards to verify
  const { data: cards } = await supabase
    .from("user_cards")
    .select("id, word_id, word:words(french, english, category, cefr_level)")
    .eq("user_id", user.id)
    .in("status", ["mastered", "review"])
    .order("last_review", { ascending: true })
    .limit(8);

  if (!cards || cards.length < 3) {
    return NextResponse.json({ error: "Need at least 3 mastered/review words to test" }, { status: 400 });
  }

  const words = cards.map((c: any) => ({
    french: c.word.french,
    english: c.word.english,
    category: c.word.category,
    level: c.word.cefr_level,
    cardId: c.id,
    wordId: c.word_id,
  }));

  const prompt = masteryVerificationPrompt({
    words: words.map(w => ({ french: w.french, english: w.english, category: w.category, level: w.level })),
    examType: profile?.target_exam || "TCF",
    level: profile?.current_level || "B1",
  });

  const result = await callClaude({ userId: user.id, prompt, maxTokens: 1024 });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let test;
  try { test = JSON.parse(result.content); } catch { return NextResponse.json({ error: "Failed to parse" }, { status: 500 }); }

  // Attach card IDs to questions for demotion
  if (test.questions) {
    test.questions = test.questions.map((q: any, i: number) => ({
      ...q,
      card_id: words[i]?.cardId,
      word_id: words[i]?.wordId,
    }));
  }

  return NextResponse.json({ test, wordCount: words.length });
}

/**
 * Submit verification results — demote failed words
 */
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { results } = await req.json();
  // results: [{ card_id, passed: boolean }]

  let demoted = 0;
  let confirmed = 0;

  for (const r of results || []) {
    if (!r.card_id) continue;

    if (!r.passed) {
      // DEMOTE: back to learning, reset interval
      await supabase
        .from("user_cards")
        .update({
          status: "learning",
          interval_days: 1,
          repetition: 0,
          next_review: new Date().toISOString(),
        })
        .eq("id", r.card_id)
        .eq("user_id", user.id);
      demoted++;
    } else {
      confirmed++;
    }
  }

  return NextResponse.json({ demoted, confirmed, message: `${confirmed} confirmed, ${demoted} sent back for review` });
}
