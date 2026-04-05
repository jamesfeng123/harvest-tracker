import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HarvestTable } from "@/components/dashboard/harvest-table";
import { Profile } from "@/lib/types";

export default async function DashboardPage() {
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

  if (!profile) redirect("/login");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Harvest Dashboard</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          Real-time updates enabled
        </div>
      </div>
      <HarvestTable profile={profile as Profile} />
    </div>
  );
}
