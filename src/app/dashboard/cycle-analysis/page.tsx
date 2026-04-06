"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { HarvestRecord, FacilityConfig, RoomConfig } from "@/lib/types";

interface CycleStats {
  cycle: number;
  roomsCompleted: number;
  totalYield: number;
  avgYieldPerRoom: number;
  avgLaborPerRoom: number;
  maxLaborPerRoom: number;
  avgYieldPerLight: number | null;
  avgYieldPerPlant: number | null;
}

export default function CycleAnalysisPage() {
  const supabase = createClient();
  const [records, setRecords] = useState<HarvestRecord[]>([]);
  const [config, setConfig] = useState<FacilityConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [recordsRes, configRes] = await Promise.all([
      supabase.from("harvest_records").select("*"),
      supabase.from("facility_config").select("*").limit(1).single(),
    ]);
    if (recordsRes.data) setRecords(recordsRes.data);
    if (configRes.data) setConfig(configRes.data as FacilityConfig);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const roomMap = useMemo(() => {
    if (!config) return {} as Record<string, RoomConfig>;
    const map: Record<string, RoomConfig> = {};
    for (const r of config.room_sequence) map[r.room] = r;
    return map;
  }, [config]);

  const stats: CycleStats[] = useMemo(() => {
    const completed = records.filter(
      (r) => r.trim_start_date && r.trim_end_date && r.labor_units > 0 && r.yield_lbs > 0
    );
    const grouped: Record<number, HarvestRecord[]> = {};
    for (const r of completed) {
      if (!grouped[r.cycle_number]) grouped[r.cycle_number] = [];
      grouped[r.cycle_number].push(r);
    }

    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map((cycle) => {
        const recs = grouped[cycle];
        const roomsCompleted = recs.length;
        const totalYield = recs.reduce((s, r) => s + r.yield_lbs, 0);
        const avgYieldPerRoom = totalYield / roomsCompleted;
        const labors = recs.map((r) => r.labor_units);
        const avgLaborPerRoom = labors.reduce((s, v) => s + v, 0) / roomsCompleted;
        const maxLaborPerRoom = Math.max(...labors);

        // Aggregate yield/light and yield/plant
        let totalLights = 0;
        let totalPlants = 0;
        for (const r of recs) {
          const cfg = roomMap[r.room_number];
          totalLights += cfg?.lights ?? 0;
          totalPlants += cfg?.plants ?? 0;
        }
        const avgYieldPerLight = totalLights > 0 ? totalYield / totalLights : null;
        const avgYieldPerPlant = totalPlants > 0 ? totalYield / totalPlants : null;

        return {
          cycle,
          roomsCompleted,
          totalYield,
          avgYieldPerRoom,
          avgLaborPerRoom,
          maxLaborPerRoom,
          avgYieldPerLight,
          avgYieldPerPlant,
        };
      });
  }, [records, roomMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Cycle Analysis</h1>

      {stats.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          <p className="text-lg">No completed cycles yet.</p>
          <p className="text-sm mt-1">Data will appear here once harvests are completed.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2.5">Cycle</th>
                  <th className="px-3 py-2.5">Rooms Completed</th>
                  <th className="px-3 py-2.5">Total Yield</th>
                  <th className="px-3 py-2.5">Avg Yield/Room</th>
                  <th className="px-3 py-2.5">Avg Labor/Room</th>
                  <th className="px-3 py-2.5">Max Labor/Room</th>
                  <th className="px-3 py-2.5">Avg Yield/Light</th>
                  <th className="px-3 py-2.5">Avg Yield/Plant</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr
                    key={s.cycle}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-semibold text-gray-900">{s.cycle}</td>
                    <td className="px-3 py-2.5 text-gray-700">{s.roomsCompleted}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">
                      {s.totalYield.toFixed(2)} lbs
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{s.avgYieldPerRoom.toFixed(2)} lbs</td>
                    <td className="px-3 py-2.5 text-gray-700">{s.avgLaborPerRoom.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-gray-700">{s.maxLaborPerRoom}</td>
                    <td className="px-3 py-2.5 text-gray-700">
                      {s.avgYieldPerLight != null ? s.avgYieldPerLight.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">
                      {s.avgYieldPerPlant != null ? s.avgYieldPerPlant.toFixed(4) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
