import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StudyClient from "@/components/study/StudyClient";
import StudySetup from "@/components/study/StudySetup";
import { getDeckPlanForUser } from "@/lib/study/deck-plan";
import { recommendDailyMission } from "@/lib/study/daily-mission";
import { buildPersonalizedStudyQueue } from "@/lib/study/queue";
import { extractWritingFocusSignals } from "@/lib/study/review-focus";

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ ready?: string }>;
}) {
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

  if (!profile?.onboarding_complete) redirect("/placement");

  const dailyGoal = profile.daily_goal || 10;
  const sessionLimit = profile.session_limit === 999 ? 150 : profile.session_limit || dailyGoal;
  const userLevel = profile.current_level || "A1";
  const params = await searchParams;
  const isReady = params.ready === "1";

  const deckPlanResult = await getDeckPlanForUser({
    supabase,
    userId: user.id,
    currentLevel: userLevel,
  });

  if (!isReady) {
    const now = new Date().toISOString();
    const setupLevels = Array.from(
      new Set(
        [deckPlanResult.plan.levelBand.primary, deckPlanResult.plan.levelBand.support].filter(Boolean)
      )
    ) as string[];

    const { count: dueCardCount } = await supabase
      .from("user_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lte("next_review", now)
      .gt("times_seen", 0)
      .neq("status", "burned");

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
      dueCount: dueCardCount || 0,
      availableNewWordCount,
      dailyGoal,
      plan: deckPlanResult.plan,
    });

    return (
      <StudySetup
        userId={user.id}
        userLevel={userLevel}
        targetExam={profile.target_exam || "TCF"}
        dueCardCount={dueCardCount || 0}
        availableNewWordCount={availableNewWordCount}
        defaultNewWords={profile.daily_new_words ?? 5}
        dailyGoal={dailyGoal}
        preferredLang={profile.preferred_translation || "en"}
        mission={mission}
      />
    );
  }

  const now = new Date().toISOString();
  const fetchLimit = Math.min(Math.max(sessionLimit * 4, 40), 300);

  const { data: recentWritingDrills } = await supabase
    .from("exam_drills")
    .select("ai_grading")
    .eq("user_id", user.id)
    .eq("drill_type", "writing")
    .order("completed_at", { ascending: false })
    .limit(5);

  const reviewFocus = extractWritingFocusSignals(
    recentWritingDrills as Array<{ ai_grading: any }> | null
  );

  const { data: dueCards } = await supabase
    .from("user_cards")
    .select("*, word:words!inner(*)")
    .eq("user_id", user.id)
    .lte("next_review", now)
    .gt("times_seen", 0)
    .neq("status", "burned")
    .limit(fetchLimit);

  const { data: newCards } = await supabase
    .from("user_cards")
    .select("*, word:words!inner(*)")
    .eq("user_id", user.id)
    .eq("times_seen", 0)
    .neq("status", "burned")
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  const queue = buildPersonalizedStudyQueue({
    dueCards: (dueCards || []) as any[],
    newCards: (newCards || []) as any[],
    maxCards: sessionLimit,
    examType: profile.target_exam || "TCF",
    currentLevel: userLevel,
    plan: deckPlanResult.plan,
    reviewFocus,
  });

  const reviewCount = queue.filter((card) => card.times_seen > 0).length;
  const newCount = queue.filter((card) => card.times_seen === 0).length;
  const levelBandSummary = deckPlanResult.plan.levelBand.support
    ? `${deckPlanResult.plan.levelBand.primary} + ${deckPlanResult.plan.levelBand.support} support`
    : deckPlanResult.plan.levelBand.primary;

  return (
    <StudyClient
      cards={queue as any[]}
      userId={user.id}
      preferredLang={profile.preferred_translation || "en"}
      dailyGoal={dailyGoal}
      deckPlanSummary={`Plan: ${levelBandSummary} | ${reviewCount} review + ${newCount} new | ${deckPlanResult.plan.rationale}${reviewFocus.vocabToReview.length ? ` | Writing focus: ${reviewFocus.vocabToReview.slice(0, 2).join(", ")}` : ""}`}
    />
  );
}
