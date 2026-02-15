import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardsReviewed, cardsCorrect, durationSeconds } = await req.json();
  const today = new Date().toISOString().split("T")[0];

  // Upsert daily activity
  const { data: existing } = await supabase
    .from("daily_activity")
    .select("*")
    .eq("user_id", user.id)
    .eq("activity_date", today)
    .single();

  if (existing) {
    await supabase
      .from("daily_activity")
      .update({
        cards_reviewed: (existing.cards_reviewed || 0) + (cardsReviewed || 0),
        cards_correct: (existing.cards_correct || 0) + (cardsCorrect || 0),
        study_minutes: (existing.study_minutes || 0) + Math.ceil((durationSeconds || 0) / 60),
        sessions_count: (existing.sessions_count || 0) + 1,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("daily_activity").insert({
      user_id: user.id,
      activity_date: today,
      cards_reviewed: cardsReviewed || 0,
      cards_correct: cardsCorrect || 0,
      study_minutes: Math.ceil((durationSeconds || 0) / 60),
      sessions_count: 1,
    });
  }

  // Update streak
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_streak, longest_streak, last_study_date")
    .eq("id", user.id)
    .single();

  let newStreak = 1;
  if (profile?.last_study_date) {
    const lastDate = new Date(profile.last_study_date);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day — keep streak
      newStreak = profile.current_streak || 1;
    } else if (diffDays === 1) {
      // Consecutive day — increment
      newStreak = (profile.current_streak || 0) + 1;
    }
    // diffDays > 1 means streak broken, reset to 1
  }

  const longestStreak = Math.max(newStreak, profile?.longest_streak || 0);

  await supabase
    .from("profiles")
    .update({
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_study_date: today,
    })
    .eq("id", user.id);

  return NextResponse.json({ streak: newStreak, longest: longestStreak });
}
