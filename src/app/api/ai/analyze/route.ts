import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, getCachedResponse, cacheResponse } from "@/lib/ai/claude";
import { progressAnalysisPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check today's cache
  const cached = await getCachedResponse(user.id, "progress_analysis");
  if (cached) {
    try {
      return NextResponse.json({ analysis: JSON.parse(cached), cached: true });
    } catch { /* generate fresh */ }
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: cards } = await supabase
    .from("user_cards")
    .select("status, times_seen, times_correct, times_wrong, word:words(category)")
    .eq("user_id", user.id);

  const allCards = cards || [];
  const totalSeen = allCards.reduce((s, c) => s + (c.times_seen || 0), 0);
  const totalCorrect = allCards.reduce((s, c) => s + (c.times_correct || 0), 0);
  const accuracy = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : 0;
  const masteredCount = allCards.filter(c => c.status === "mastered").length;
  const newWords = allCards.filter(c => c.times_seen && c.times_seen > 0 && c.times_seen <= 2).length;

  const catStats: Record<string, { correct: number; total: number }> = {};
  allCards.forEach(c => {
    const cat = (c.word as any)?.category || "unknown";
    if (!catStats[cat]) catStats[cat] = { correct: 0, total: 0 };
    catStats[cat].correct += c.times_correct || 0;
    catStats[cat].total += c.times_seen || 0;
  });

  const weakCategories = Object.entries(catStats).filter(([, s]) => s.total > 2 && (s.correct / s.total) < 0.65).map(([cat]) => cat);
  const strongCategories = Object.entries(catStats).filter(([, s]) => s.total > 2 && (s.correct / s.total) >= 0.85).map(([cat]) => cat);

  const { data: sessions } = await supabase
    .from("study_sessions")
    .select("started_at")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(30);

  let streak = 0;
  if (sessions && sessions.length > 0) {
    const seen: Record<string, true> = {};
    const dates = sessions.map(s => s.started_at.split("T")[0]).filter(d => (seen[d] ? false : (seen[d] = true)));
    const todayDate = new Date();
    for (let i = 0; i < dates.length; i++) {
      const expected = new Date(todayDate);
      expected.setDate(expected.getDate() - i);
      if (dates.includes(expected.toISOString().split("T")[0])) streak++;
      else break;
    }
  }

  const prompt = progressAnalysisPrompt({
    name: profile.name || "Learner",
    level: profile.current_level,
    targetExam: profile.target_exam || "TCF",
    examDate: profile.target_exam_date,
    nativeLanguages: profile.native_languages || ["en"],
    totalReviewed: totalSeen,
    accuracy,
    newWordsLearned: newWords,
    streak,
    weakCategories,
    strongCategories,
    masteredCount,
    totalCards: allCards.length,
  });

  const result = await callClaude({ userId: user.id, prompt, maxTokens: 512 });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let analysis;
  try { analysis = JSON.parse(result.content); } catch { analysis = { summary: result.content, can_advance: false }; }

  await cacheResponse({ userId: user.id, contentType: "progress_analysis", content: JSON.stringify(analysis), tokensUsed: result.tokensUsed });

  const today = new Date().toISOString().split("T")[0];
  await supabase.from("ai_progress_snapshots").upsert({
    user_id: user.id, snapshot_date: today, current_level: profile.current_level,
    overall_accuracy: accuracy, words_mastered: masteredCount,
    words_learning: allCards.filter(c => c.status === "learning").length,
    words_new: allCards.filter(c => c.status === "new" || !c.times_seen).length,
    streak_days: streak, weak_categories: weakCategories, strong_categories: strongCategories,
    ai_assessment: analysis.summary, readiness_score: analysis.predicted_readiness_pct || 0, recommendations: analysis,
  }, { onConflict: "user_id,snapshot_date" });

  return NextResponse.json({ analysis, cached: false, streak, accuracy, masteredCount, totalCards: allCards.length });
}
