import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, getCachedResponse, cacheResponse } from "@/lib/ai/claude";
import { mnemonicPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { wordId, french, english, hindi, punjabi, partOfSpeech, level, example } = await req.json();
  if (!french || !english) return NextResponse.json({ error: "french and english required" }, { status: 400 });

  // Check cache first
  if (wordId) {
    const cached = await getCachedResponse(user.id, "mnemonic", wordId);
    if (cached) {
      try {
        return NextResponse.json({ mnemonic: JSON.parse(cached), cached: true });
      } catch {
        return NextResponse.json({ mnemonic: { mnemonic: cached }, cached: true });
      }
    }
  }

  // Get user's preferred language — THIS IS THE FIX
  const { data: profile } = await supabase
    .from("profiles")
    .select("native_languages, preferred_translation")
    .eq("id", user.id)
    .single();

  // Use preferred_translation to determine mnemonic language
  const preferredLang = (profile?.preferred_translation || "en") as "en" | "hi" | "pa";

  const prompt = mnemonicPrompt({
    french, english, hindi, punjabi, partOfSpeech,
    level: level || "A1",
    preferredLanguage: preferredLang,
    example,
  });

  const result = await callClaude({ userId: user.id, prompt, maxTokens: 256 });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let mnemonic;
  try {
    mnemonic = JSON.parse(result.content);
  } catch {
    mnemonic = { mnemonic: result.content, bridge_language: "none", sound_bridge: null };
  }

  // Cache + save to card
  if (wordId) {
    await cacheResponse({ userId: user.id, contentType: "mnemonic", wordId, content: JSON.stringify(mnemonic), tokensUsed: result.tokensUsed });
    await supabase.from("user_cards").update({ ai_mnemonic: mnemonic.mnemonic }).eq("user_id", user.id).eq("word_id", wordId);
  }

  return NextResponse.json({ mnemonic, cached: false });
}
