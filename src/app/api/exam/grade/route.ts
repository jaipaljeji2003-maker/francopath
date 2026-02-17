import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import { writingGradePrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task, taskNumber, submission, examType } = await req.json();

  if (!submission || submission.trim().length < 20) {
    return NextResponse.json({ error: "Submission too short (minimum 20 characters)" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, native_languages, target_exam")
    .eq("id", user.id)
    .single();

  const prompt = writingGradePrompt({
    examType: examType || profile?.target_exam || "TCF",
    level: profile?.current_level || "A1",
    taskNumber: taskNumber || 1,
    task: task || "General writing task",
    submission,
    nativeLanguages: profile?.native_languages || ["en"],
  });

  const result = await callClaude({ userId: user.id, prompt, maxTokens: 1200 });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let grading;
  try { grading = JSON.parse(result.content); } catch { grading = { overall_score: 0, comment: result.content }; }

  // Save to exam_drills for history tracking
  await supabase.from("exam_drills").insert({
    user_id: user.id,
    drill_type: "writing",
    exam_type: examType || profile?.target_exam || "TCF",
    questions: { task, taskNumber },
    answers: { submission },
    score: grading.overall_score,
    max_score: grading.max_score || 20,
    ai_grading: grading,
    completed: true,
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ grading });
}
