import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PlacementClient from "@/components/placement/PlacementClient";

export default async function PlacementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_complete) {
    redirect("/dashboard");
  }

  return <PlacementClient userId={user.id} userName={profile?.name || ""} />;
}
