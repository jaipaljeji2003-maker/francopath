import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { recommendDailyMission } from "@/lib/study/daily-mission";
import { getDeckPlanForUser } from "@/lib/study/deck-plan";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile && !profile.onboarding_complete) redirect("/placement");

  const userLevel = profile?.current_level || "A0";
  const deckPlanResult = await getDeckPlanForUser({
    supabase,
    userId: user.id,
    currentLevel: userLevel,
  });

  const { data: cards } = await supabase
    .from("user_cards")
    .select("id, status, next_review, times_seen, times_correct, times_wrong, word:words!inner(cefr_level)")
    .eq("user_id", user.id)
    .neq("status", "burned");

  const now = new Date().toISOString();
  const allCards = cards || [];
  const dueCount = allCards.filter((card) => card.next_review <= now && card.times_seen > 0).length;
  const queuedCount = allCards.filter((card) => card.times_seen === 0).length;
  const masteredCount = allCards.filter((card) => card.status === "mastered").length;
  const totalCorrect = allCards.reduce((sum, card) => sum + (card.times_correct || 0), 0);
  const totalSeen = allCards.reduce((sum, card) => sum + (card.times_seen || 0), 0);
  const accuracy = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todaySessions } = await supabase
    .from("study_sessions")
    .select("cards_reviewed")
    .eq("user_id", user.id)
    .gte("started_at", todayStart.toISOString());

  const setupLevels = Array.from(
    new Set(
      [deckPlanResult.plan.levelBand.primary, deckPlanResult.plan.levelBand.support].filter(Boolean)
    )
  ) as string[];

  const { data: setupWordInventory } = await supabase
    .from("words")
    .select("id, cefr_level")
    .in("cefr_level", setupLevels);

  const { data: setupUserCards } = await supabase
    .from("user_cards")
    .select("word:words!inner(cefr_level)")
    .eq("user_id", user.id)
    .in("word.cefr_level", setupLevels);

  const totalWordsInBand = (setupWordInventory || []).length;
  const userCardsInBand = (setupUserCards || []).length;
  const availableNewWordCount = Math.max(0, totalWordsInBand - userCardsInBand);
  const mission = recommendDailyMission({
    dueCount,
    availableNewWordCount,
    dailyGoal: profile?.daily_goal || 10,
    plan: deckPlanResult.plan,
  });

  const todayReviewed = (todaySessions || []).reduce(
    (sum, session) => sum + (session.cards_reviewed || 0),
    0
  );
  const streak = profile?.current_streak || 0;

  return (
    <DashboardClient
      profile={profile}
      userId={user.id}
      mission={mission}
      stats={{
        dueCount,
        queuedCount,
        masteredCount,
        totalCards: allCards.length,
        accuracy,
        streak,
        todayReviewed,
      }}
    />
  );
}
