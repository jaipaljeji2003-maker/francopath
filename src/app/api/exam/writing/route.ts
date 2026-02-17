import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import { writingTaskPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskNumber, examType, questionType } = await req.json();

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, target_exam")
    .eq("id", user.id)
    .single();

  // Get recent vocab user is learning (for personalized tasks)
  const { data: recentCards } = await supabase
    .from("user_cards")
    .select("word:words(french)")
    .eq("user_id", user.id)
    .in("status", ["learning", "review"])
    .order("last_review", { ascending: false })
    .limit(15);

  const recentVocab = (recentCards || [])
    .map((c: any) => c.word?.french)
    .filter(Boolean);

  const prompt = writingTaskPrompt({
    examType: examType || profile?.target_exam || "TCF",
    level: profile?.current_level || "A1",
    taskNumber: taskNumber || 1,
    questionType,
    recentVocab,
  });

  const result = await callClaude({ userId: user.id, prompt, maxTokens: 768 });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let task;
  try { task = JSON.parse(result.content); } catch { return NextResponse.json({ error: "Failed to parse task" }, { status: 500 }); }

  return NextResponse.json({ task });
}
