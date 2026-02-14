import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
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

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-lg mx-auto px-5 py-8">
        <h1 className="text-2xl font-extrabold mb-6">⚙️ Settings</h1>

        <div className="space-y-4">
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-3">Profile</h3>
            <div className="text-sm text-brand-muted space-y-1">
              <p>Name: {profile?.name}</p>
              <p>Level: {profile?.current_level}</p>
              <p>Exam: {profile?.target_exam}</p>
              <p>Languages: {profile?.native_languages?.join(", ")}</p>
            </div>
          </div>

          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-3">🔑 Bring Your Own API Key</h3>
            <p className="text-xs text-brand-dim mb-3">
              Connect your Anthropic API key for unlimited AI features.
              Your key is encrypted and never shared.
            </p>
            <p className="text-xs text-brand-muted bg-brand-accent/5 rounded-lg px-3 py-2">
              Coming in Phase 3 — Currently using platform AI allocation.
            </p>
          </div>
        </div>

        <a
          href="/dashboard"
          className="block mt-6 text-center text-brand-accent text-sm hover:underline"
        >
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}
