import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecordForm } from "@/components/dashboard/record-form";
import { HarvestRecord, FacilityConfig } from "@/lib/types";

export default async function RecordEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: record }, { data: config }] = await Promise.all([
    supabase.from("harvest_records").select("*").eq("id", id).single(),
    supabase.from("facility_config").select("*").limit(1).single(),
  ]);

  if (!record) notFound();

  const facilityConfig = config as FacilityConfig | null;
  const roomConfig = facilityConfig?.room_sequence?.find(
    (r) => r.room === (record as HarvestRecord).room_number
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Harvest Record</h1>
      <RecordForm
        record={record as HarvestRecord}
        laborRate={facilityConfig?.labor_rate ?? 0}
        plants={roomConfig?.plants ?? 0}
        lights={roomConfig?.lights ?? 0}
      />
    </div>
  );
}
