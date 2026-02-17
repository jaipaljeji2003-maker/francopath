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
    .select("current_level, target_exam")
    .eq("id", user.id)
    .single();

  // Card stats
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

  // Writing history
  const { data: writingDrills } = await supabase
    .from("exam_drills")
    .select("score, max_score, questions")
    .eq("user_id", user.id)
    .eq("drill_type", "writing")
    .eq("completed", true)
    .order("completed_at", { ascending: false })
    .limit(10);

  const writingHistory = (writingDrills || []).map(d => ({
    taskNumber: (d.questions as any)?.taskNumber || 1,
    score: d.score || 0,
    maxScore: d.max_score || 20,
  }));

  // Study days count
  const { data: activity } = await supabase
    .from("daily_activity")
    .select("activity_date")
    .eq("user_id", user.id);

  const prompt = scorePredictionPrompt({
    examType: profile?.target_exam || "TCF",
    level: profile?.current_level || "A1",
    accuracy,
    masteredWords: mastered,
    totalWords: allCards.length,
    weakAreas,
    writingHistory,
    totalStudyDays: (activity || []).length,
    totalReviews: totalSeen,
  });

  const result = await callClaude({ userId: user.id, prompt, maxTokens: 768 });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let prediction;
  try { prediction = JSON.parse(result.content); } catch { prediction = { has_enough_data: false, honest_assessment: result.content }; }

  return NextResponse.json({
    prediction,
    stats: { accuracy, mastered, total: allCards.length, writingCount: writingHistory.length, studyDays: (activity || []).length },
  });
}
