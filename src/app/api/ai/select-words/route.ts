import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import { wordSelectionPrompt } from "@/lib/ai/prompts";

/**
 * POST /api/ai/select-words
 * AI picks personalized words for the user's daily deck.
 * Creates user_cards rows for selected words.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count, difficulty } = await req.json();
  if (!count || count < 1 || count > 20) {
    return NextResponse.json({ error: "count must be 1-20" }, { status: 400 });
  }
  if (!["easy", "medium", "hard"].includes(difficulty)) {
    return NextResponse.json({ error: "difficulty must be easy, medium, or hard" }, { status: 400 });
  }

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, target_exam, native_languages")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const userLevel = profile.current_level || "A1";
  const targetExam = profile.target_exam || "TCF";

  // Get user's existing word_ids
  const { data: existingCards } = await supabase
    .from("user_cards")
    .select("word_id")
    .eq("user_id", user.id);

  const existingWordIds = new Set((existingCards || []).map(c => c.word_id));

  // Get available words at user's level NOT already in user_cards
  const { data: allWordsAtLevel } = await supabase
    .from("words")
    .select("id, french, english, category, tcf_frequency, tef_frequency")
    .eq("cefr_level", userLevel)
    .order("tcf_frequency", { ascending: false });

  const availableWords = (allWordsAtLevel || []).filter(w => !existingWordIds.has(w.id));

  if (availableWords.length === 0) {
    return NextResponse.json({ error: "No available words at this level", selected: [] }, { status: 200 });
  }

  const actualCount = Math.min(count, availableWords.length);

  // Get existing French words (for the prompt, to avoid confusion)
  const { data: existingWordsData } = await supabase
    .from("user_cards")
    .select("word:words!inner(french)")
    .eq("user_id", user.id)
    .limit(100);

  const existingFrenchWords = (existingWordsData || [])
    .map((c: any) => c.word?.french)
    .filter(Boolean);

  // Get weak categories (categories with low accuracy)
  const { data: cardStats } = await supabase
    .from("user_cards")
    .select("times_seen, times_correct, word:words!inner(category)")
    .eq("user_id", user.id)
    .gt("times_seen", 0);

  const catAccuracy: Record<string, { correct: number; total: number }> = {};
  (cardStats || []).forEach((c: any) => {
    const cat = c.word?.category;
    if (!cat) return;
    if (!catAccuracy[cat]) catAccuracy[cat] = { correct: 0, total: 0 };
    catAccuracy[cat].total += c.times_seen || 0;
    catAccuracy[cat].correct += c.times_correct || 0;
  });

  const weakCategories = Object.entries(catAccuracy)
    .filter(([, v]) => v.total > 0 && (v.correct / v.total) < 0.6)
    .map(([k]) => k);

  // Try AI selection
  let selectedIds: string[] = [];
  let reasoning = "";
  let theme: string | null = null;
  let usedFallback = false;

  try {
    const prompt = wordSelectionPrompt({
      level: userLevel,
      count: actualCount,
      difficulty: difficulty as "easy" | "medium" | "hard",
      targetExam: targetExam as "TCF" | "TEF",
      nativeLanguages: profile.native_languages || ["en"],
      existingFrenchWords,
      weakCategories,
      availableWords: availableWords.slice(0, 60), // cap to avoid token overflow
    });

    const response = await callClaude({ userId: user.id, prompt, maxTokens: 512 });

    if (response.content && !response.error) {
      const parsed = JSON.parse(response.content);
      const validIds = new Set(availableWords.map(w => w.id));
      const aiIds = (parsed.selected_word_ids || []).filter((id: string) => validIds.has(id));

      if (aiIds.length >= actualCount) {
        selectedIds = aiIds.slice(0, actualCount);
        reasoning = parsed.selection_reasoning || "";
        theme = parsed.theme || null;
      }
    }
  } catch {
    // AI failed, will use fallback
  }

  // Fallback: local frequency-based selection
  if (selectedIds.length < actualCount) {
    usedFallback = true;
    selectedIds = fallbackWordSelection(availableWords, actualCount, difficulty as "easy" | "medium" | "hard", targetExam as "TCF" | "TEF");
    reasoning = "Selected by exam frequency and category diversity";
  }

  // Create user_cards for selected words
  const newCards = selectedIds.map(wordId => ({ user_id: user.id, word_id: wordId }));
  if (newCards.length > 0) {
    // Use upsert with onConflict to handle race conditions (two tabs)
    await supabase
      .from("user_cards")
      .upsert(newCards, { onConflict: "user_id,word_id", ignoreDuplicates: true });
  }

  // Get the full word objects for the response
  const { data: selectedWords } = await supabase
    .from("words")
    .select("*")
    .in("id", selectedIds);

  return NextResponse.json({
    selected: selectedWords || [],
    count: selectedIds.length,
    reasoning,
    theme,
    fallback: usedFallback,
  });
}

/**
 * Fallback word selection when AI is unavailable.
 * Sorts by exam frequency based on difficulty, diversifies categories.
 */
function fallbackWordSelection(
  availableWords: Array<{ id: string; category: string; tcf_frequency: number; tef_frequency: number }>,
  count: number,
  difficulty: "easy" | "medium" | "hard",
  targetExam: "TCF" | "TEF"
): string[] {
  const freqKey = targetExam === "TCF" ? "tcf_frequency" : "tef_frequency";

  let sorted: typeof availableWords;
  if (difficulty === "easy") {
    sorted = [...availableWords].sort((a, b) => b[freqKey] - a[freqKey]);
  } else if (difficulty === "hard") {
    sorted = [...availableWords].sort((a, b) => a[freqKey] - b[freqKey]);
  } else {
    // Medium: prefer mid-range frequency (4-7), then random
    const midRange = availableWords.filter(w => w[freqKey] >= 4 && w[freqKey] <= 7);
    if (midRange.length >= count) {
      sorted = midRange.sort(() => Math.random() - 0.5);
    } else {
      sorted = [...availableWords].sort((a, b) =>
        Math.abs(5.5 - a[freqKey]) - Math.abs(5.5 - b[freqKey])
      );
    }
  }

  // Diversify categories: max 2 per category unless not enough variety
  const selected: string[] = [];
  const catCounts: Record<string, number> = {};
  for (const word of sorted) {
    if (selected.length >= count) break;
    const cat = word.category;
    if ((catCounts[cat] || 0) >= 2 && sorted.length > count * 2) continue;
    selected.push(word.id);
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }

  // If we didn't get enough (due to category limits), fill from remaining
  if (selected.length < count) {
    const selectedSet = new Set(selected);
    for (const word of sorted) {
      if (selected.length >= count) break;
      if (!selectedSet.has(word.id)) {
        selected.push(word.id);
      }
    }
  }

  return selected;
}
