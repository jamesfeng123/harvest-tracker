"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HarvestRecord } from "@/lib/types";
import { computeStage } from "@/lib/constants";

interface RecordFormProps {
  record: HarvestRecord;
  laborRate: number;
  plants: number;
  lights: number;
}

export function RecordForm({ record, laborRate, plants, lights }: RecordFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    trim_start_date: record.trim_start_date ?? "",
    trim_end_date: record.trim_end_date ?? "",
    labor_units: record.labor_units,
    yield_lbs: record.yield_lbs,
    dry_room_id: record.dry_room_id ?? "",
  });

  const calculations = useMemo(() => {
    const laborCost = formData.labor_units * laborRate;
    const costPerLb = formData.yield_lbs > 0 ? laborCost / formData.yield_lbs : 0;
    const yieldPerLight = lights > 0 ? formData.yield_lbs / lights : 0;
    const yieldPerPlant = plants > 0 ? formData.yield_lbs / plants : 0;
    return { laborCost, costPerLb, yieldPerLight, yieldPerPlant };
  }, [formData.labor_units, formData.yield_lbs, laborRate, lights, plants]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const stage = computeStage(
      formData.trim_start_date || null,
      formData.trim_end_date || null
    );

    const { error: updateError } = await supabase
      .from("harvest_records")
      .update({
        trim_start_date: formData.trim_start_date || null,
        trim_end_date: formData.trim_end_date || null,
        labor_units: formData.labor_units,
        yield_lbs: formData.yield_lbs,
        dry_room_id: formData.dry_room_id || null,
        stage,
      })
      .eq("id", record.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  }

  return (
    <div className="flex gap-6 flex-col lg:flex-row">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4 max-w-lg flex-1">
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
          <span>Cycle {record.cycle_number}</span>
          <span>Room {record.room_number}</span>
          <span>{plants} plants</span>
          <span>{lights} lights</span>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 p-3 rounded text-sm">
            Record saved successfully.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trim Start Date
          </label>
          <input
            type="date"
            name="trim_start_date"
            value={formData.trim_start_date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trim End Date
          </label>
          <input
            type="date"
            name="trim_end_date"
            value={formData.trim_end_date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Labor Units
          </label>
          <input
            type="number"
            name="labor_units"
            value={formData.labor_units}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Yield (lbs)
          </label>
          <input
            type="number"
            name="yield_lbs"
            value={formData.yield_lbs}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dry Room ID
          </label>
          <input
            type="text"
            name="dry_room_id"
            value={formData.dry_room_id}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g. DR-1"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </form>

      {/* Live Calculations Panel */}
      <div className="bg-white rounded-lg shadow p-6 max-w-sm h-fit">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Live Calculations</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Labor Rate</dt>
            <dd className="font-medium text-gray-900">
              ${laborRate.toLocaleString("en-US", { minimumFractionDigits: 2 })}/unit
            </dd>
          </div>
          <div className="flex justify-between border-t pt-3">
            <dt className="text-gray-500">Total Labor Cost</dt>
            <dd className="font-bold text-gray-900">
              ${calculations.laborCost.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </dd>
          </div>
          <div className="flex justify-between border-t pt-3">
            <dt className="text-gray-500">Cost/lb</dt>
            <dd className="font-bold text-gray-900">
              {formData.yield_lbs > 0
                ? "$" + calculations.costPerLb.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between border-t pt-3">
            <dt className="text-gray-500">Yield/Light</dt>
            <dd className="font-bold text-gray-900">
              {lights > 0 ? calculations.yieldPerLight.toFixed(2) : "—"}
            </dd>
          </div>
          <div className="flex justify-between border-t pt-3">
            <dt className="text-gray-500">Yield/Plant</dt>
            <dd className="font-bold text-gray-900">
              {plants > 0 ? calculations.yieldPerPlant.toFixed(4) : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
