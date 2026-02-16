import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Check if user qualifies for exam prep unlock.
 * Criteria: ≥80% accuracy + ≥70% of cards at review/mastered status
 * (In production you'd require B2 level; for testing we're lenient)
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, exam_prep_unlocked")
    .eq("id", user.id)
    .single();

  if (profile?.exam_prep_unlocked) {
    return NextResponse.json({ unlocked: true, message: "Already unlocked" });
  }

  // Get card stats
  const { data: cards } = await supabase
    .from("user_cards")
    .select("status, times_seen, times_correct")
    .eq("user_id", user.id);

  const allCards = cards || [];
  if (allCards.length === 0) {
    return NextResponse.json({ unlocked: false, reason: "No cards yet" });
  }

  const totalSeen = allCards.reduce((s, c) => s + (c.times_seen || 0), 0);
  const totalCorrect = allCards.reduce((s, c) => s + (c.times_correct || 0), 0);
  const accuracy = totalSeen > 0 ? (totalCorrect / totalSeen) * 100 : 0;
  const reviewOrMastered = allCards.filter(c => c.status === "review" || c.status === "mastered").length;
  const progressPct = (reviewOrMastered / allCards.length) * 100;

  // For testing: lower bar. For production: require B2 level
  const qualifies = accuracy >= 70 && progressPct >= 50;

  if (qualifies) {
    await supabase
      .from("profiles")
      .update({ exam_prep_unlocked: true })
      .eq("id", user.id);

    return NextResponse.json({ unlocked: true, message: "Exam prep unlocked! 🎓" });
  }

  return NextResponse.json({
    unlocked: false,
    accuracy: Math.round(accuracy),
    progress: Math.round(progressPct),
    reason: `Need ≥70% accuracy (you: ${Math.round(accuracy)}%) and ≥50% cards reviewed (you: ${Math.round(progressPct)}%)`,
  });
}
