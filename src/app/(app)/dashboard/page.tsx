import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // If not onboarded, redirect to placement
  if (profile && !profile.onboarding_complete) {
    redirect("/placement");
  }

  // Get user card stats
  const { data: cards } = await supabase
    .from("user_cards")
    .select("id, status, next_review, times_seen, times_correct, times_wrong")
    .eq("user_id", user.id);

  const now = new Date().toISOString();
  const allCards = cards || [];
  const dueCount = allCards.filter((c) => c.next_review <= now && c.times_seen > 0).length;
  const newCount = allCards.filter((c) => c.times_seen === 0).length;
  const masteredCount = allCards.filter((c) => c.status === "mastered").length;
  const totalCorrect = allCards.reduce((sum, c) => sum + (c.times_correct || 0), 0);
  const totalSeen = allCards.reduce((sum, c) => sum + (c.times_seen || 0), 0);
  const accuracy = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : 0;

  // Get today's sessions
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todaySessions } = await supabase
    .from("study_sessions")
    .select("cards_reviewed")
    .eq("user_id", user.id)
    .gte("started_at", todayStart.toISOString());

  const todayReviewed = (todaySessions || []).reduce((sum, s) => sum + (s.cards_reviewed || 0), 0);

  return (
    <DashboardClient
      profile={profile}
      stats={{
        dueCount,
        newCount,
        masteredCount,
        totalCards: allCards.length,
        accuracy,
        streak: 0, // TODO: calculate from sessions
        todayReviewed,
      }}
    />
  );
}
