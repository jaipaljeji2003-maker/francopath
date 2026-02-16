import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ExamPrepClient from "@/components/exam/ExamPrepClient";

export default async function ExamPrepPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_complete) redirect("/placement");

  // Get drill history
  const { data: drills } = await supabase
    .from("exam_drills")
    .select("id, drill_type, exam_type, score, max_score, completed, completed_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Get card stats for readiness
  const { data: cards } = await supabase
    .from("user_cards")
    .select("status, times_seen, times_correct")
    .eq("user_id", user.id);

  const allCards = cards || [];
  const totalSeen = allCards.reduce((s, c) => s + (c.times_seen || 0), 0);
  const totalCorrect = allCards.reduce((s, c) => s + (c.times_correct || 0), 0);
  const mastered = allCards.filter(c => c.status === "mastered").length;

  return (
    <ExamPrepClient
      profile={profile}
      isUnlocked={!!profile.exam_prep_unlocked}
      drillHistory={drills || []}
      stats={{
        accuracy: totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : 0,
        mastered,
        totalCards: allCards.length,
      }}
    />
  );
}
