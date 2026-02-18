import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile && !profile.onboarding_complete) redirect("/placement");

  // Card stats — filtered to user's current level only
  const userLevel = profile?.current_level || "A0";
  const { data: cards } = await supabase
    .from("user_cards")
    .select("id, status, next_review, times_seen, times_correct, times_wrong, word:words!inner(cefr_level)")
    .eq("user_id", user.id)
    .eq("word.cefr_level", userLevel);

  const now = new Date().toISOString();
  const allCards = cards || [];
  const dueCount = allCards.filter((c) => c.next_review <= now && c.times_seen > 0).length;
  const newCount = allCards.filter((c) => c.times_seen === 0).length;
  const masteredCount = allCards.filter((c) => c.status === "mastered").length;
  const totalCorrect = allCards.reduce((s, c) => s + (c.times_correct || 0), 0);
  const totalSeen = allCards.reduce((s, c) => s + (c.times_seen || 0), 0);
  const accuracy = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : 0;

  // Today's sessions
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todaySessions } = await supabase
    .from("study_sessions")
    .select("cards_reviewed")
    .eq("user_id", user.id)
    .gte("started_at", todayStart.toISOString());

  const todayReviewed = (todaySessions || []).reduce((s, sess) => s + (sess.cards_reviewed || 0), 0);

  // Streak from profile (updated by study sessions)
  const streak = profile?.current_streak || 0;

  return (
    <DashboardClient
      profile={profile}
      userId={user.id}
      stats={{
        dueCount,
        newCount,
        masteredCount,
        totalCards: allCards.length,
        accuracy,
        streak,
        todayReviewed,
      }}
    />
  );
}
