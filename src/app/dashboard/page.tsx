import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HarvestTable } from "@/components/dashboard/harvest-table";
import { Profile, FacilityConfig } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: config }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("facility_config").select("*").limit(1).single(),
  ]);

  if (!profile) redirect("/login");

  const facilityConfig = config as FacilityConfig | null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Harvest Dashboard</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          Real-time updates enabled
        </div>
      </div>
      <HarvestTable
        profile={profile as Profile}
        laborRate={facilityConfig?.labor_rate ?? 0}
        roomSequence={facilityConfig?.room_sequence ?? []}
      />
    </div>
  );
}
