import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import { writingPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskType, examType } = await req.json();

  const { data: profile } = await supabase
    .from("profiles")
    .select("exam_prep_unlocked, current_level, target_exam")
    .eq("id", user.id)
    .single();

  if (!profile?.exam_prep_unlocked) {
    return NextResponse.json({ error: "Exam prep not unlocked" }, { status: 403 });
  }

  const prompt = writingPrompt({
    examType: examType || profile.target_exam || "TCF",
    level: profile.current_level,
    taskType: taskType || "formal_letter",
  });

  const result = await callClaude({ userId: user.id, feature: "drills_used", prompt, maxTokens: 768 });

  if (result.error) {
    if (result.limitReached) {
      return NextResponse.json({ error: "Daily limit reached.", limitReached: true }, { status: 429 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let task;
  try { task = JSON.parse(result.content); } catch { return NextResponse.json({ error: "Failed to parse task" }, { status: 500 }); }

  return NextResponse.json({ task });
}
