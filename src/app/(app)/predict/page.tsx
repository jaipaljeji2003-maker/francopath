import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PredictionClient from "@/components/exam/PredictionClient";

export default async function PredictPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, target_exam")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/placement");

  return <PredictionClient level={profile.current_level} examType={profile.target_exam || "TCF"} />;
}
