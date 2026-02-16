import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import expandedWords from "@/data/expanded-words.json";

/**
 * POST /api/dev/seed-words — seeds expanded word bank
 * Skips duplicates by checking existing French words
 * Protected by DEV_MODE_SECRET
 */
export async function POST(req: NextRequest) {
  const secret = process.env.DEV_MODE_SECRET;
  if (!secret) return NextResponse.json({ error: "Dev mode not enabled" }, { status: 403 });

  const { secret: reqSecret } = await req.json();
  if (reqSecret !== secret) return NextResponse.json({ error: "Invalid secret" }, { status: 403 });

  const supabase = await createClient();

  // Get existing words to avoid duplicates
  const { data: existing } = await supabase.from("words").select("french");
  const existingSet = new Set((existing || []).map(w => w.french.toLowerCase()));

  // Filter to only new words
  const newWords = (expandedWords as any[]).filter(
    w => !existingSet.has(w.french.toLowerCase())
  );

  if (newWords.length === 0) {
    return NextResponse.json({ message: "All words already exist", added: 0, total: existingSet.size });
  }

  // Insert in batches of 50
  let added = 0;
  for (let i = 0; i < newWords.length; i += 50) {
    const batch = newWords.slice(i, i + 50).map(w => ({
      french: w.french,
      english: w.english,
      hindi: w.hindi,
      punjabi: w.punjabi,
      part_of_speech: w.part_of_speech,
      gender: w.gender,
      cefr_level: w.cefr_level,
      category: w.category,
      example_sentence: w.example_sentence,
      example_translation_en: w.example_translation_en,
      tcf_frequency: w.tcf_frequency,
      tef_frequency: w.tef_frequency,
      false_friend_warning: w.false_friend_warning,
      notes: w.notes,
    }));

    const { error } = await supabase.from("words").insert(batch);
    if (error) {
      return NextResponse.json({ error: error.message, added, batch_failed: i }, { status: 500 });
    }
    added += batch.length;
  }

  return NextResponse.json({
    message: `Seeded ${added} new words`,
    added,
    skipped: expandedWords.length - added,
    total: existingSet.size + added,
  });
}
