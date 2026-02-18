import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WordBrowserClient from "@/components/words/WordBrowserClient";

export default async function WordsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, native_languages, preferred_translation")
    .eq("id", user.id)
    .single();

  // Show ALL words the user has cards for (active vocabulary only, no level filter)
  const { data: userCards } = await supabase
    .from("user_cards")
    .select("word_id, status, times_correct, times_seen, ai_mnemonic, word:words!inner(*)")
    .eq("user_id", user.id)
    .order("status", { ascending: true });

  // Build words array from user cards only
  const words = (userCards || [])
    .filter((c: any) => c.word)
    .map((c: any) => c.word);

  const cardMap: Record<string, { status: string; accuracy: number; mnemonic: string | null }> = {};
  (userCards || []).forEach((c: any) => {
    cardMap[c.word_id] = {
      status: c.status || "new",
      accuracy: c.times_seen ? Math.round((c.times_correct / c.times_seen) * 100) : 0,
      mnemonic: c.ai_mnemonic,
    };
  });

  return (
    <WordBrowserClient
      words={words}
      cardMap={cardMap}
      userLevel={profile?.current_level || "A0"}
      preferredLang={profile?.preferred_translation || "en"}
    />
  );
}
