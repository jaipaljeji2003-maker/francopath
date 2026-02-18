import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StudyClient from "@/components/study/StudyClient";
import StudySetup from "@/components/study/StudySetup";

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ ready?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_complete) redirect("/placement");

  const dailyGoal = profile.daily_goal || 10;
  const userLevel = profile.current_level || "A1";
  const params = await searchParams;
  const isReady = params.ready === "1";

  // ─── SETUP MODE: show pre-session page ───
  if (!isReady) {
    const now = new Date().toISOString();

    // Count due review cards at user's level
    const { count: dueCardCount } = await supabase
      .from("user_cards")
      .select("id, word:words!inner(cefr_level)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("word.cefr_level", userLevel)
      .lte("next_review", now)
      .gt("times_seen", 0)
      .neq("status", "burned");

    // Count available new words (words at level NOT in user_cards)
    const { count: totalWordsAtLevel } = await supabase
      .from("words")
      .select("id", { count: "exact", head: true })
      .eq("cefr_level", userLevel);

    const { count: userCardsAtLevel } = await supabase
      .from("user_cards")
      .select("id, word:words!inner(cefr_level)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("word.cefr_level", userLevel);

    const availableNewWordCount = (totalWordsAtLevel || 0) - (userCardsAtLevel || 0);

    return (
      <StudySetup
        userId={user.id}
        userLevel={userLevel}
        targetExam={profile.target_exam || "TCF"}
        dueCardCount={dueCardCount || 0}
        availableNewWordCount={Math.max(0, availableNewWordCount)}
        defaultNewWords={profile.daily_new_words ?? 5}
        dailyGoal={dailyGoal}
        preferredLang={profile.preferred_translation || "en"}
      />
    );
  }

  // ─── STUDY MODE: serve cards ───
  const now = new Date().toISOString();

  // 1. Due cards at user's level (review cards that need revisiting)
  const { data: dueCards } = await supabase
    .from("user_cards")
    .select("*, word:words!inner(*)")
    .eq("user_id", user.id)
    .eq("word.cefr_level", userLevel)
    .lte("next_review", now)
    .gt("times_seen", 0)
    .neq("status", "burned")
    .order("next_review", { ascending: true })
    .limit(dailyGoal);

  const dueCount = dueCards?.length || 0;

  // 2. New cards at user's level (recently added, unseen vocab)
  const newCardCount = Math.max(2, dailyGoal - dueCount);
  const { data: newCards } = await supabase
    .from("user_cards")
    .select("*, word:words!inner(*)")
    .eq("user_id", user.id)
    .eq("word.cefr_level", userLevel)
    .eq("times_seen", 0)
    .neq("status", "burned")
    .order("created_at", { ascending: false }) // newest first (just added from setup)
    .limit(newCardCount);

  const newCount = newCards?.length || 0;

  const queue = [...(dueCards || []), ...(newCards || [])];

  // Shuffle
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  return (
    <StudyClient
      cards={queue.slice(0, dailyGoal)}
      userId={user.id}
      preferredLang={profile.preferred_translation || "en"}
      dailyGoal={dailyGoal}
      deckPlanSummary={`Studying: ${userLevel} only · ${dueCount} review + ${newCount} new`}
    />
  );
}
