import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import { sessionPlanPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, daily_goal")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const now = new Date().toISOString();

  // Get card stats
  const { data: cards } = await supabase
    .from("user_cards")
    .select("status, next_review, times_seen, times_correct, times_wrong, word:words(category)")
    .eq("user_id", user.id);

  const allCards = cards || [];
  const dueCount = allCards.filter(c => c.next_review <= now && (c.times_seen || 0) > 0).length;
  const newCount = allCards.filter(c => !c.times_seen || c.times_seen === 0).length;
  const totalCorrect = allCards.reduce((s, c) => s + (c.times_correct || 0), 0);
  const totalSeen = allCards.reduce((s, c) => s + (c.times_seen || 0), 0);
  const accuracy = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : 75;

  // Weak categories
  const catStats: Record<string, { correct: number; total: number }> = {};
  allCards.forEach(c => {
    const cat = (c.word as any)?.category || "unknown";
    if (!catStats[cat]) catStats[cat] = { correct: 0, total: 0 };
    catStats[cat].correct += c.times_correct || 0;
    catStats[cat].total += c.times_seen || 0;
  });
  const weakCategories = Object.entries(catStats)
    .filter(([, s]) => s.total > 2 && (s.correct / s.total) < 0.65)
    .map(([cat]) => cat);

  // Count today's sessions
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: sessionCount } = await supabase
    .from("study_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("started_at", todayStart.toISOString());

  const prompt = sessionPlanPrompt({
    level: profile.current_level,
    accuracy,
    dueCount,
    newCount,
    weakCategories,
    sessionNumber: (sessionCount || 0) + 1,
    dailyGoal: profile.daily_goal || 10,
  });

  const result = await callClaude({ userId: user.id, feature: "session_plans_used", prompt, maxTokens: 256 });

  if (result.error) {
    // Fallback: rule-based plan if AI fails
    const reviewCards = Math.min(dueCount, 7);
    const newCards = Math.min(newCount, 3);
    return NextResponse.json({
      plan: {
        review_cards: reviewCards,
        new_cards: newCards,
        focus_category: weakCategories[0] || null,
        session_tip: "Focus on your due cards first, then try some new ones.",
        difficulty_adjustment: "normal",
      },
      fallback: true,
    });
  }

  let plan;
  try { plan = JSON.parse(result.content); } catch { plan = { review_cards: 7, new_cards: 3, session_tip: result.content, difficulty_adjustment: "normal" }; }

  return NextResponse.json({ plan, fallback: false });
}
