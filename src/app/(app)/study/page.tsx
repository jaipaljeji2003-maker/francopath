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

  // ─── LEVEL-LOCKED STUDY ───
  // Only serve cards AT the user's current level.
  // If user is B1, they study B1 vocab only — not A0/A1/A2 basics.
  // This keeps the challenge at the optimal zone (not too easy, not too hard).

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

  // 3. If not enough cards at current level, pull from one level below as support
  let supportCards: typeof dueCards = [];
  const levelOrder = ["A0", "A1", "A2", "B1", "B2"];
  const levelIdx = levelOrder.indexOf(userLevel);
  const totalSoFar = dueCount + newCount;

  if (totalSoFar < dailyGoal && levelIdx > 0) {
    const supportLevel = levelOrder[levelIdx - 1];
    const supportNeeded = dailyGoal - totalSoFar;

    // Support: due cards from one level below
    const { data: supportDue } = await supabase
      .from("user_cards")
      .select("*, word:words!inner(*)")
      .eq("user_id", user.id)
      .eq("word.cefr_level", supportLevel)
      .lte("next_review", now)
      .gt("times_seen", 0)
      .neq("status", "burned")
      .order("next_review", { ascending: true })
      .limit(supportNeeded);

    const supportDueCount = supportDue?.length || 0;
    const supportNewNeeded = supportNeeded - supportDueCount;

    let supportNew: typeof dueCards = [];
    if (supportNewNeeded > 0) {
      const { data } = await supabase
        .from("user_cards")
        .select("*, word:words!inner(*)")
        .eq("user_id", user.id)
        .eq("word.cefr_level", supportLevel)
        .eq("times_seen", 0)
        .neq("status", "burned")
        .order("created_at", { ascending: true })
        .limit(supportNewNeeded);
      supportNew = data || [];
    }

    supportCards = [...(supportDue || []), ...(supportNew || [])];
  }

  const queue = [...(dueCards || []), ...(newCards || []), ...(supportCards || [])];

  // Shuffle
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  const supportCount = supportCards?.length || 0;
  const levelLabel = supportCount > 0
    ? `${userLevel} + ${levelOrder[levelIdx - 1]} support`
    : userLevel;

  return (
    <StudyClient
      cards={queue.slice(0, dailyGoal)}
      userId={user.id}
      preferredLang={profile.preferred_translation || "en"}
      dailyGoal={dailyGoal}
      deckPlanSummary={`Studying: ${levelLabel} · ${dueCount} review + ${newCount} new`}
    />
  );
}
