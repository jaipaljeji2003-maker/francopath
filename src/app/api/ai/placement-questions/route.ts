import { NextRequest, NextResponse } from "next/server";
import { callClaude } from "@/lib/ai/claude";
import { placementTestPrompt } from "@/lib/ai/prompts";
import staticQuestions from "@/data/placement-questions.json";

export async function POST(req: NextRequest) {
  try {
    const prompt = placementTestPrompt({});
    // Use a dummy userId for placement (user not yet fully set up)
    const result = await callClaude({ userId: "placement-test", prompt, maxTokens: 2048 });

    if (result.error) {
      // Fallback to static questions if AI fails
      return NextResponse.json({ questions: staticQuestions, source: "static" });
    }

    let questions;
    try {
      questions = JSON.parse(result.content);
      if (!Array.isArray(questions) || questions.length < 10) {
        return NextResponse.json({ questions: staticQuestions, source: "static" });
      }
    } catch {
      return NextResponse.json({ questions: staticQuestions, source: "static" });
    }

    return NextResponse.json({ questions, source: "ai" });
  } catch {
    return NextResponse.json({ questions: staticQuestions, source: "static" });
  }
}
