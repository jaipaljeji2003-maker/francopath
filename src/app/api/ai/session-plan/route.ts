import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDeckPlanForUser } from "@/lib/study/deck-plan";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const result = await getDeckPlanForUser({
    supabase,
    userId: user.id,
    currentLevel: profile.current_level,
  });

  return NextResponse.json(result);
}
