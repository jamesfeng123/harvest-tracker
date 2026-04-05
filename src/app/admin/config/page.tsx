import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfigForm } from "@/components/admin/config-form";
import { FacilityConfig } from "@/lib/types";

export default async function AdminConfigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: config } = await supabase
    .from("facility_config")
    .select("*")
    .limit(1)
    .single();

  if (!config) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Facility Configuration</h1>
        <p className="text-gray-600">
          No configuration found. Please run the database schema to create the
          default configuration.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Facility Configuration</h1>
      <ConfigForm config={config as FacilityConfig} />
    </div>
  );
}
