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

  // Due cards first (NOT burned)
  const { data: dueCards } = await supabase
    .from("user_cards")
    .select("*, word:words(*)")
    .eq("user_id", user.id)
    .lte("next_review", now)
    .gt("times_seen", 0)
    .neq("status", "burned")
    .order("next_review", { ascending: true })
    .limit(Math.ceil(dailyGoal * 0.7));

  // New cards — served in seed order (highest exam frequency first, since seed data is pre-sorted)
  const newCardCount = Math.max(2, Math.floor(dailyGoal * 0.3));
  const { data: newCards } = await supabase
    .from("user_cards")
    .select("*, word:words(*)")
    .eq("user_id", user.id)
    .eq("times_seen", 0)
    .neq("status", "burned")
    .order("created_at", { ascending: true })
    .limit(newCardCount);

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
    />
  );
}
