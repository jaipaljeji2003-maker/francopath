import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StudyClient from "@/components/study/StudyClient";

export default async function StudyPage() {
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
  const now = new Date().toISOString();
  const userLevel = profile.current_level || "A1";

  // ─── STRICT LEVEL-LOCKED STUDY ───
  // ONLY serve cards AT the user's current level. NO exceptions.
  // B2 = only B2 vocab. A1 = only A1 vocab. No support levels, no mixing.
  // User can manually drop to a lower level from settings if they want easier vocab.

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

  // 2. New cards at user's level (unseen vocab to learn)
  const newCardCount = Math.max(2, dailyGoal - dueCount);
  const { data: newCards } = await supabase
    .from("user_cards")
    .select("*, word:words!inner(*)")
    .eq("user_id", user.id)
    .eq("word.cefr_level", userLevel)
    .eq("times_seen", 0)
    .neq("status", "burned")
    .order("created_at", { ascending: true })
    .limit(newCardCount);

  const newCount = newCards?.length || 0;

  // No support cards — strict level lock only
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
