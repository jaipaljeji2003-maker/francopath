import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import { listeningDrillPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenario, examType } = await req.json();

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, target_exam")
    .eq("id", user.id)
    .single();

  const prompt = listeningDrillPrompt({
    examType: examType || profile?.target_exam || "TCF",
    level: profile?.current_level || "B1",
    scenario: scenario || "conversation",
  });

  const result = await callClaude({ userId: user.id, feature: "drills_used", prompt, maxTokens: 1024 });

  if (result.error) {
    if (result.limitReached) {
      return NextResponse.json({ error: "Daily limit reached.", limitReached: true }, { status: 429 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let drill;
  try { drill = JSON.parse(result.content); } catch { return NextResponse.json({ error: "Failed to parse" }, { status: 500 }); }

  // Save to exam_drills
  const { data: saved } = await supabase
    .from("exam_drills")
    .insert({
      user_id: user.id,
      drill_type: "listening",
      exam_type: examType || profile?.target_exam || "TCF",
      questions: drill,
      max_score: drill.questions?.length || 4,
      time_limit_seconds: 300,
    })
    .select("id")
    .single();

  return NextResponse.json({ drill, drillId: saved?.id });
}
