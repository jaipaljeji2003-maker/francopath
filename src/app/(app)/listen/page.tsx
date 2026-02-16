import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ListeningClient from "@/components/exam/ListeningClient";

export default async function ListenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, target_exam")
    .eq("id", user.id)
    .single();

  return (
    <ListeningClient
      level={profile?.current_level || "B1"}
      examType={profile?.target_exam || "TCF"}
    />
  );
}
