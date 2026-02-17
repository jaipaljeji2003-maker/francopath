/**
 * FrancoPath Claude AI Client (Simplified)
 * No BYOK, no rate limits during dev. Direct platform key usage.
 * Will switch to subscription model at launch.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import { SYSTEM_PROMPT } from "./prompts";

interface ClaudeCallOptions {
  userId: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
}

interface ClaudeResponse {
  content: string;
  tokensUsed: number;
  error?: string;
}

/**
 * Direct Claude API call — no rate limiting during dev phase
 */
export async function callClaude(options: ClaudeCallOptions): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { content: "", tokensUsed: 0, error: "ANTHROPIC_API_KEY not configured" };
  }

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
      return { content: "", tokensUsed: 0, error: `api_error: ${response.status} - ${errorBody}` };
    }

    const data = await response.json();
    const content = data.content?.[0]?.type === "text" ? data.content[0].text : "";
    const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

    // Track usage (lightweight, no rate limiting)
    await trackUsage(options.userId, tokensUsed);

    return { content, tokensUsed };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { content: "", tokensUsed: 0, error: `fetch_error: ${message}` };
  }
}

/**
 * Check cache for previously generated content
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

  if (wordId) query = query.eq("word_id", wordId);

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

// Lightweight usage tracking (no limits, just monitoring)
async function trackUsage(userId: string, tokens: number) {
  const supabase = await createServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("ai_usage")
    .select("id, total_tokens_used")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .single();

  if (existing) {
    await supabase
      .from("ai_usage")
      .update({ total_tokens_used: (existing.total_tokens_used || 0) + tokens })
      .eq("id", existing.id);
  } else {
    await supabase.from("ai_usage").insert({
      user_id: userId,
      usage_date: today,
      total_tokens_used: tokens,
    });
  }
}
