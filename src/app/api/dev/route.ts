import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Dev mode API — only works when DEV_MODE_SECRET env var is set
 * Actions: unlock_all, set_level, reset_progress, seed_activity
 */
export async function POST(req: NextRequest) {
  const secret = process.env.DEV_MODE_SECRET;
  if (!secret) return NextResponse.json({ error: "Dev mode not enabled" }, { status: 403 });

  const { action, secret: reqSecret, level, userId } = await req.json();
  if (reqSecret !== secret) return NextResponse.json({ error: "Invalid secret" }, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const targetUser = userId || user?.id;
  if (!targetUser) return NextResponse.json({ error: "No user" }, { status: 401 });

  switch (action) {
    case "unlock_all": {
      await supabase.from("profiles").update({
        exam_prep_unlocked: true,
        onboarding_complete: true,
        current_level: "B2",
        current_streak: 15,
        longest_streak: 30,
      }).eq("id", targetUser);

      // DEV CONVENIENCE: Seed all cards (bypasses normal StudySetup flow)
      // In production, users add words via the pre-session setup
      const { data: words } = await supabase.from("words").select("id");
      const { data: existingCards } = await supabase
        .from("user_cards")
        .select("word_id")
        .eq("user_id", targetUser);

      const existingIds = new Set((existingCards || []).map(c => c.word_id));
      const newCards = (words || [])
        .filter(w => !existingIds.has(w.id))
        .map(w => ({ user_id: targetUser, word_id: w.id }));

      if (newCards.length > 0) {
        for (let i = 0; i < newCards.length; i += 50) {
          await supabase.from("user_cards").insert(newCards.slice(i, i + 50));
        }
      }

      return NextResponse.json({ success: true, message: "All features unlocked, level set to B2, cards initialized (dev bypass)" });
    }

    case "set_level": {
      if (!level) return NextResponse.json({ error: "level required" }, { status: 400 });
      await supabase.from("profiles").update({ current_level: level }).eq("id", targetUser);
      return NextResponse.json({ success: true, message: `Level set to ${level}` });
    }

    case "simulate_progress": {
      // Set ~40% of cards to review/mastered with fake stats
      const { data: cards } = await supabase
        .from("user_cards")
        .select("id")
        .eq("user_id", targetUser);

      const allCards = cards || [];
      const shuffled = allCards.sort(() => Math.random() - 0.5);
      const masteredCount = Math.floor(shuffled.length * 0.25);
      const reviewCount = Math.floor(shuffled.length * 0.20);

      for (let i = 0; i < masteredCount; i++) {
        await supabase.from("user_cards").update({
          status: "mastered", times_seen: 8, times_correct: 7, times_wrong: 1,
          ease_factor: 2.8, interval_days: 30, repetition: 6,
        }).eq("id", shuffled[i].id);
      }
      for (let i = masteredCount; i < masteredCount + reviewCount; i++) {
        await supabase.from("user_cards").update({
          status: "review", times_seen: 4, times_correct: 3, times_wrong: 1,
          ease_factor: 2.3, interval_days: 7, repetition: 3,
        }).eq("id", shuffled[i].id);
      }

      // Add some daily activity
      const today = new Date();
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        await supabase.from("daily_activity").upsert({
          user_id: targetUser,
          activity_date: date.toISOString().split("T")[0],
          cards_reviewed: Math.floor(Math.random() * 20) + 5,
          cards_correct: Math.floor(Math.random() * 15) + 3,
          study_minutes: Math.floor(Math.random() * 20) + 5,
          sessions_count: Math.floor(Math.random() * 3) + 1,
        }, { onConflict: "user_id,activity_date" });
      }

      return NextResponse.json({ success: true, message: `Simulated progress: ${masteredCount} mastered, ${reviewCount} reviewing, 7 days activity` });
    }

    case "reset_progress": {
      // Delete user_cards entirely (simulates fresh user with no vocabulary)
      await supabase.from("card_reviews").delete().eq("user_id", targetUser);
      await supabase.from("user_cards").delete().eq("user_id", targetUser);
      await supabase.from("daily_activity").delete().eq("user_id", targetUser);
      await supabase.from("study_sessions").delete().eq("user_id", targetUser);
      await supabase.from("exam_drills").delete().eq("user_id", targetUser);
      await supabase.from("profiles").update({
        current_streak: 0, longest_streak: 0, last_study_date: null, exam_prep_unlocked: false,
      }).eq("id", targetUser);
      return NextResponse.json({ success: true, message: "All progress reset (cards deleted, fresh start)" });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
