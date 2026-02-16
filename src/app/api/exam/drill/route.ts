import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import { comprehensionDrillPrompt, vocabDrillPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { drillType, examType, category, focusArea } = await req.json();

  // Verify exam prep is unlocked
  const { data: profile } = await supabase
    .from("profiles")
    .select("exam_prep_unlocked, current_level, native_languages, target_exam")
    .eq("id", user.id)
    .single();

  if (!profile?.exam_prep_unlocked) {
    return NextResponse.json({ error: "Exam prep not unlocked. Reach B2 level first." }, { status: 403 });
  }

  const exam = examType || profile.target_exam || "TCF";
  const langs = profile.native_languages || ["en"];

  let prompt: string;
  if (drillType === "vocab") {
    prompt = vocabDrillPrompt({ examType: exam, level: profile.current_level, focusArea: focusArea || "general vocabulary" });
  } else {
    prompt = comprehensionDrillPrompt({ examType: exam, level: profile.current_level, category: category || "reading", nativeLanguages: langs });
  }

  const result = await callClaude({ userId: user.id, feature: "drills_used", prompt, maxTokens: 1024 });

  if (result.error) {
    if (result.limitReached) {
      return NextResponse.json({ error: "Daily drill limit reached. Add your API key in Settings for unlimited.", limitReached: true }, { status: 429 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let drill;
  try { drill = JSON.parse(result.content); } catch { return NextResponse.json({ error: "Failed to parse drill" }, { status: 500 }); }

  // Save drill to DB
  const { data: saved } = await supabase
    .from("exam_drills")
    .insert({
      user_id: user.id,
      drill_type: drillType || "comprehension",
      exam_type: exam,
      questions: drill,
      max_score: drill.questions?.length || 5,
      time_limit_seconds: drillType === "vocab" ? 300 : 600,
    })
    .select("id")
    .single();

  return NextResponse.json({ drill, drillId: saved?.id });
}
