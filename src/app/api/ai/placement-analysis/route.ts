import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import { placementAnalysisPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { score, total, answers, determinedLevel } = await req.json();

  const { data: profile } = await supabase
    .from("profiles")
    .select("native_languages")
    .eq("id", user.id)
    .single();

  const prompt = placementAnalysisPrompt({
    score,
    total,
    answers,
    nativeLanguages: profile?.native_languages || ["en"],
    determinedLevel,
  });

  const result = await callClaude({ userId: user.id, feature: "analyses_used", prompt, maxTokens: 384 });

  if (result.error) {
    // Fallback if AI fails
    return NextResponse.json({
      analysis: {
        level_confidence: Math.round((score / total) * 100),
        strengths: ["basics"],
        weaknesses: ["advanced grammar"],
        first_week_focus: "Review core vocabulary at your level",
        encouragement: "Welcome to FrancoPath! Let's start your French journey! 🇫🇷",
      },
      fallback: true,
    });
  }

  let analysis;
  try { analysis = JSON.parse(result.content); } catch { analysis = { encouragement: result.content, level_confidence: Math.round((score / total) * 100) }; }

  // Save analysis to placement result
  const { data: placementResult } = await supabase
    .from("placement_results")
    .select("id")
    .eq("user_id", user.id)
    .order("taken_at", { ascending: false })
    .limit(1)
    .single();

  if (placementResult) {
    await supabase
      .from("placement_results")
      .update({ ai_analysis: JSON.stringify(analysis) })
      .eq("id", placementResult.id);
  }

  return NextResponse.json({ analysis, fallback: false });
}
