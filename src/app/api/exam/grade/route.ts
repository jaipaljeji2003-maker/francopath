import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import { writingGradePrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task, submission, examType } = await req.json();

  if (!submission || submission.trim().length < 20) {
    return NextResponse.json({ error: "Submission too short (minimum 20 characters)" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("exam_prep_unlocked, current_level, native_languages, target_exam")
    .eq("id", user.id)
    .single();

  if (!profile?.exam_prep_unlocked) {
    return NextResponse.json({ error: "Exam prep not unlocked" }, { status: 403 });
  }

  const prompt = writingGradePrompt({
    examType: examType || profile.target_exam || "TCF",
    level: profile.current_level,
    task: task || "General writing task",
    submission,
    nativeLanguages: profile.native_languages || ["en"],
  });

  const result = await callClaude({ userId: user.id, feature: "writing_grades_used", prompt, maxTokens: 1200 });

  if (result.error) {
    if (result.limitReached) {
      return NextResponse.json({ error: "Daily grading limit reached. Add your API key for unlimited.", limitReached: true }, { status: 429 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let grading;
  try { grading = JSON.parse(result.content); } catch { grading = { overall_score: 0, comment: result.content }; }

  return NextResponse.json({ grading });
}
