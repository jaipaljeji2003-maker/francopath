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
      return NextResponse.json({ mnemonic: JSON.parse(cached), cached: true });
    }
  }

  // Get user's native languages
  const { data: profile } = await supabase
    .from("profiles")
    .select("native_languages")
    .eq("id", user.id)
    .single();

  const prompt = mnemonicPrompt({
    french, english, hindi, punjabi, partOfSpeech,
    level: level || "A1",
    nativeLanguages: profile?.native_languages || ["en"],
    example,
  });

  const result = await callClaude({ userId: user.id, feature: "mnemonics_used", prompt, maxTokens: 256 });

  if (result.error) {
    if (result.limitReached) {
      return NextResponse.json({ error: "Daily limit reached. Add your API key in Settings for unlimited.", limitReached: true }, { status: 429 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let mnemonic;
  try { mnemonic = JSON.parse(result.content); } catch { mnemonic = { mnemonic: result.content, bridge_language: "none", sound_bridge: null }; }

  // Cache + save to card
  if (wordId) {
    await cacheResponse({ userId: user.id, contentType: "mnemonic", wordId, content: JSON.stringify(mnemonic), tokensUsed: result.tokensUsed });
    await supabase.from("user_cards").update({ ai_mnemonic: mnemonic.mnemonic }).eq("user_id", user.id).eq("word_id", wordId);
  }

  return NextResponse.json({ mnemonic, cached: false });
}
