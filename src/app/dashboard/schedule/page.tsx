import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HarvestTable } from "@/components/dashboard/harvest-table";
import { FacilityConfig } from "@/lib/types";

export default async function HarvestSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: config } = await supabase
    .from("facility_config")
    .select("*")
    .limit(1)
    .single();

  const facilityConfig = config as FacilityConfig | null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Harvest Schedule</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          Real-time updates enabled
        </div>
      </div>
      <HarvestTable
        laborRate={facilityConfig?.labor_rate ?? 0}
        roomSequence={facilityConfig?.room_sequence ?? []}
        facilityConfig={{
          rotationStartDate:
            facilityConfig?.rotation_start_date ?? "2026-03-15",
          rotationInterval:
            facilityConfig?.rotation_interval_days ?? 5,
          totalCycles: facilityConfig?.total_cycles ?? 0,
        }}
      />
    </div>
  );
}
