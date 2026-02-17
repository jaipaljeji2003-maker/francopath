import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PlacementClient from "@/components/placement/PlacementClient";

export default async function PlacementPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, onboarding_complete")
    .eq("id", user.id)
    .single();

  // If already onboarded, this is a retake
  return (
    <PlacementClient
      userId={user.id}
      userName={profile?.name || ""}
      isRetake={!!profile?.onboarding_complete}
    />
  );
}
