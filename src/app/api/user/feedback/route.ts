import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { feedbackType, content, pageUrl, context, rating } = await req.json();

  if (!content || content.trim().length < 3) {
    return NextResponse.json({ error: "Feedback too short" }, { status: 400 });
  }

  const { error } = await supabase.from("user_feedback").insert({
    user_id: user.id,
    feedback_type: feedbackType || "general",
    content: content.trim(),
    page_url: pageUrl,
    context: context || {},
    rating: rating || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_feedback")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ feedback: data || [] });
}
