import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import { scorePredictionPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("exam_prep_unlocked, current_level, target_exam")
    .eq("id", user.id)
    .single();

  if (!profile?.exam_prep_unlocked) {
    return NextResponse.json({ error: "Exam prep not unlocked" }, { status: 403 });
  }

  // Get drill history
  const { data: drills } = await supabase
    .from("exam_drills")
    .select("drill_type, score, max_score")
    .eq("user_id", user.id)
    .eq("completed", true)
    .order("completed_at", { ascending: false })
    .limit(20);

  // Get card stats
  const { data: cards } = await supabase
    .from("user_cards")
    .select("status, times_seen, times_correct, times_wrong, word:words(category)")
    .eq("user_id", user.id);

  const allCards = cards || [];
  const totalSeen = allCards.reduce((s, c) => s + (c.times_seen || 0), 0);
  const totalCorrect = allCards.reduce((s, c) => s + (c.times_correct || 0), 0);
  const accuracy = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : 0;
  const mastered = allCards.filter(c => c.status === "mastered").length;

  // Weak areas
  const catStats: Record<string, { c: number; t: number }> = {};
  allCards.forEach(c => {
    const cat = (c.word as any)?.category || "unknown";
    if (!catStats[cat]) catStats[cat] = { c: 0, t: 0 };
    catStats[cat].c += c.times_correct || 0;
    catStats[cat].t += c.times_seen || 0;
  });
  const weakAreas = Object.entries(catStats)
    .filter(([, s]) => s.t > 2 && (s.c / s.t) < 0.65)
    .map(([cat]) => cat);

  const prompt = scorePredictionPrompt({
    examType: profile.target_exam || "TCF",
    drillHistory: (drills || []).map(d => ({ type: d.drill_type, score: d.score || 0, maxScore: d.max_score || 5 })),
    accuracy,
    level: profile.current_level,
    masteredWords: mastered,
    totalWords: allCards.length,
    weakAreas,
  });

  const result = await callClaude({ userId: user.id, feature: "analyses_used", prompt, maxTokens: 768 });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let prediction;
  try { prediction = JSON.parse(result.content); } catch { prediction = { predicted_level: profile.current_level, encouragement: result.content }; }

  return NextResponse.json({ prediction, stats: { accuracy, mastered, total: allCards.length, drillsCompleted: (drills || []).length } });
}
