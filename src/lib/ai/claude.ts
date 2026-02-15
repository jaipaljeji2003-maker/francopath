/**
 * FrancoPath Claude AI Client
 * Handles API calls with BYOK key resolution, rate limiting, and caching
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import { SYSTEM_PROMPT } from "./prompts";

// Free tier daily limits
const FREE_TIER_LIMITS: Record<string, number> = {
  mnemonics_used: 5,
  drills_used: 2,
  writing_grades_used: 1,
  analyses_used: 1,
  session_plans_used: 50,
};

interface ClaudeCallOptions {
  userId: string;
  feature: "mnemonics_used" | "drills_used" | "writing_grades_used" | "analyses_used" | "session_plans_used";
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
}

interface ClaudeResponse {
  content: string;
  isByok: boolean;
  tokensUsed: number;
  error?: string;
  limitReached?: boolean;
}

/**
 * Main entry point — resolves BYOK vs platform key, checks rate limits, makes the call
 */
export async function callClaude(options: ClaudeCallOptions): Promise<ClaudeResponse> {
  const supabase = await createServerClient();

  // 1. Get user profile to check BYOK status
  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_tier, byok_encrypted_key, byok_key_valid")
    .eq("id", options.userId)
    .single();

  let apiKey: string;
  let isByok = false;

  // 2. Determine which key to use
  if (
    profile?.ai_tier === "byok" &&
    profile?.byok_encrypted_key &&
    profile?.byok_key_valid
  ) {
    apiKey = decryptSimple(profile.byok_encrypted_key);
    isByok = true;
  } else {
    // Free tier — check rate limits
    const withinLimit = await checkRateLimit(options.userId, options.feature);
    if (!withinLimit) {
      return {
        content: "",
        isByok: false,
        tokensUsed: 0,
        error: "daily_limit_reached",
        limitReached: true,
      };
    }
    apiKey = process.env.ANTHROPIC_API_KEY!;
    if (!apiKey) {
      return {
        content: "",
        isByok: false,
        tokensUsed: 0,
        error: "no_api_key_configured",
      };
    }
  }

  // 3. Make the API call
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: options.maxTokens || 512,
        system: options.systemPrompt || SYSTEM_PROMPT,
        messages: [{ role: "user", content: options.prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      if (isByok && (response.status === 401 || response.status === 403)) {
        await supabase
          .from("profiles")
          .update({ byok_key_valid: false, ai_tier: "free" })
          .eq("id", options.userId);
        return { content: "", isByok: true, tokensUsed: 0, error: "byok_key_invalid" };
      }

      return { content: "", isByok, tokensUsed: 0, error: `api_error: ${response.status} - ${errorBody}` };
    }

    const data = await response.json();
    const content = data.content?.[0]?.type === "text" ? data.content[0].text : "";
    const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

    // 4. Track usage
    await trackUsage(options.userId, options.feature, tokensUsed);

    return { content, isByok, tokensUsed };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { content: "", isByok, tokensUsed: 0, error: `fetch_error: ${message}` };
  }
}

/**
 * Check if a cached response exists
 */
export async function getCachedResponse(
  userId: string,
  contentType: string,
  wordId?: string
): Promise<string | null> {
  const supabase = await createServerClient();

  let query = supabase
    .from("ai_generated_content")
    .select("content")
    .eq("user_id", userId)
    .eq("content_type", contentType);

  if (wordId) {
    query = query.eq("word_id", wordId);
  }

  const { data } = await query.order("created_at", { ascending: false }).limit(1).single();
  return data?.content || null;
}

/**
 * Store a response in cache
 */
export async function cacheResponse(params: {
  userId: string;
  contentType: string;
  wordId?: string;
  content: string;
  tokensUsed: number;
}) {
  const supabase = await createServerClient();

  await supabase.from("ai_generated_content").insert({
    user_id: params.userId,
    content_type: params.contentType,
    word_id: params.wordId || null,
    content: params.content,
    tokens_used: params.tokensUsed,
  });
}

// ─── Rate Limiting ───

async function checkRateLimit(userId: string, feature: string): Promise<boolean> {
  const supabase = await createServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("ai_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .single();

  if (!data) return true;

  const currentUsage = (data as Record<string, number>)[feature] || 0;
  const limit = FREE_TIER_LIMITS[feature] || 5;
  return currentUsage < limit;
}

async function trackUsage(userId: string, feature: string, tokens: number) {
  const supabase = await createServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("ai_usage")
    .select("id, total_tokens_used, " + feature)
    .eq("user_id", userId)
    .eq("usage_date", today)
    .single();

  if (existing) {
    const currentVal = (existing as Record<string, number>)[feature] || 0;
    await supabase
      .from("ai_usage")
      .update({
        [feature]: currentVal + 1,
        total_tokens_used: (existing.total_tokens_used || 0) + tokens,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("ai_usage").insert({
      user_id: userId,
      usage_date: today,
      [feature]: 1,
      total_tokens_used: tokens,
    });
  }
}

// ─── Simple Encryption (BYOK) ───

function decryptSimple(encrypted: string): string {
  try {
    return Buffer.from(encrypted, "base64").toString("utf-8");
  } catch {
    return encrypted;
  }
}

export function encryptSimple(plainKey: string): string {
  return Buffer.from(plainKey, "utf-8").toString("base64");
}

export async function validateApiKey(key: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: 'Say "ok"' }],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
