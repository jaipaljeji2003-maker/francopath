import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateApiKey, encryptSimple } from "@/lib/ai/claude";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { apiKey } = await req.json();
  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    return NextResponse.json({ error: "Invalid key format. Must start with sk-ant-" }, { status: 400 });
  }

  // Validate
  const isValid = await validateApiKey(apiKey);
  if (!isValid) {
    return NextResponse.json({ error: "API key is not valid. Check your key at console.anthropic.com" }, { status: 400 });
  }

  // Encrypt and store
  const encrypted = encryptSimple(apiKey);
  await supabase
    .from("profiles")
    .update({
      byok_encrypted_key: encrypted,
      byok_key_valid: true,
      byok_key_added_at: new Date().toISOString(),
      ai_tier: "byok",
    })
    .eq("id", user.id);

  return NextResponse.json({ success: true, tier: "byok" });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase
    .from("profiles")
    .update({
      byok_encrypted_key: null,
      byok_key_valid: false,
      byok_key_added_at: null,
      ai_tier: "free",
    })
    .eq("id", user.id);

  return NextResponse.json({ success: true, tier: "free" });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_tier, byok_key_valid, byok_key_added_at")
    .eq("id", user.id)
    .single();

  // Get today's usage
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("ai_usage")
    .select("*")
    .eq("user_id", user.id)
    .eq("usage_date", today)
    .single();

  return NextResponse.json({
    tier: profile?.ai_tier || "free",
    keyValid: profile?.byok_key_valid || false,
    keyAddedAt: profile?.byok_key_added_at,
    todayUsage: usage || { mnemonics_used: 0, drills_used: 0, analyses_used: 0 },
    limits: profile?.ai_tier === "byok" ? null : {
      mnemonics: 5,
      drills: 2,
      analyses: 1,
    },
  });
}
