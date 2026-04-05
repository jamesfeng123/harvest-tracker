import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecordForm } from "@/components/dashboard/record-form";
import { HarvestRecord } from "@/lib/types";

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

  const { data: record } = await supabase
    .from("harvest_records")
    .select("*")
    .eq("id", id)
    .single();

  if (!record) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Harvest Record</h1>
      <RecordForm record={record as HarvestRecord} />
    </div>
  );
}
