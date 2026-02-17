import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MasteryTestClient from "@/components/exam/MasteryTestClient";

export default async function VerifyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, target_exam")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/placement");

  return <MasteryTestClient level={profile.current_level} examType={profile.target_exam || "TCF"} />;
}
