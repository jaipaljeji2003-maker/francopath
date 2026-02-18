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
  const userLevel = profile.current_level || "A0";
  const levelOrder = ["A0", "A1", "A2", "B1", "B2"];
  const userLevelIdx = levelOrder.indexOf(userLevel);

  // Due cards first (NOT burned)
  const { data: dueCards } = await supabase
    .from("user_cards")
    .select("*, word:words(*)")
    .eq("user_id", user.id)
    .lte("next_review", now)
    .gt("times_seen", 0)
    .neq("status", "burned")
    .order("next_review", { ascending: true })
    .limit(dailyGoal);

  const dueCount = dueCards?.length || 0;

  // Fill remaining slots with new cards — prioritize user's current level
  // Fetch more than needed so we can sort by level relevance
  const newCardCount = Math.max(2, dailyGoal - dueCount);
  const { data: rawNewCards } = await supabase
    .from("user_cards")
    .select("*, word:words(*)")
    .eq("user_id", user.id)
    .eq("times_seen", 0)
    .neq("status", "burned")
    .order("created_at", { ascending: true })
    .limit(newCardCount * 3);

  // Sort new cards: prioritize words at/near user's level, then by exam frequency
  const newCards = (rawNewCards || [])
    .sort((a, b) => {
      const aLevel = levelOrder.indexOf(a.word?.cefr_level || "A0");
      const bLevel = levelOrder.indexOf(b.word?.cefr_level || "A0");
      // Distance from user's level (0 = same level, higher = further away)
      const aDist = Math.abs(aLevel - userLevelIdx);
      const bDist = Math.abs(bLevel - userLevelIdx);
      if (aDist !== bDist) return aDist - bDist; // Closer to user level first
      // Same distance: prefer higher level
      if (aLevel !== bLevel) return bLevel - aLevel;
      // Same level: prefer higher exam frequency
      return (b.word?.tcf_frequency || 0) - (a.word?.tcf_frequency || 0);
    })
    .slice(0, newCardCount);

  const queue = [...(dueCards || []), ...newCards];

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
