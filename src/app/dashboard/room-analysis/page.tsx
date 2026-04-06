"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { HarvestRecord, FacilityConfig, RoomConfig } from "@/lib/types";

interface RoomStats {
  room: string;
  harvests: number;
  totalYield: number;
  avgYield: number;
  avgTrimLabor: number;
  minTrimLabor: number;
  maxTrimLabor: number;
  avgYieldPerLight: number | null;
  plants: number;
  avgYieldPerPlant: number | null;
}

export default function RoomAnalysisPage() {
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

  const stats: RoomStats[] = useMemo(() => {
    // Only completed records
    const completed = records.filter(
      (r) => r.trim_start_date && r.trim_end_date && r.labor_units > 0 && r.yield_lbs > 0
    );
    const grouped: Record<string, HarvestRecord[]> = {};
    for (const r of completed) {
      if (!grouped[r.room_number]) grouped[r.room_number] = [];
      grouped[r.room_number].push(r);
    }

    // Use room sequence order if available
    const roomOrder = config?.room_sequence.map((r: RoomConfig) => r.room) ?? Object.keys(grouped);

    return roomOrder
      .filter((room: string) => grouped[room]?.length > 0)
      .map((room: string) => {
        const recs = grouped[room];
        const harvests = recs.length;
        const totalYield = recs.reduce((s, r) => s + r.yield_lbs, 0);
        const avgYield = totalYield / harvests;
        const labors = recs.map((r) => r.labor_units);
        const avgTrimLabor = labors.reduce((s, v) => s + v, 0) / harvests;
        const minTrimLabor = Math.min(...labors);
        const maxTrimLabor = Math.max(...labors);
        const roomCfg = roomMap[room];
        const lights = roomCfg?.lights ?? 0;
        const plants = roomCfg?.plants ?? 0;
        const avgYieldPerLight = lights > 0 ? avgYield / lights : null;
        const avgYieldPerPlant = plants > 0 ? avgYield / plants : null;

        return {
          room,
          harvests,
          totalYield,
          avgYield,
          avgTrimLabor,
          minTrimLabor,
          maxTrimLabor,
          avgYieldPerLight,
          plants,
          avgYieldPerPlant,
        };
      });
  }, [records, config, roomMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Room Analysis</h1>

      {stats.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          <p className="text-lg">No completed harvests yet.</p>
          <p className="text-sm mt-1">Data will appear here once harvests are completed.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2.5">Room</th>
                  <th className="px-3 py-2.5">Harvests</th>
                  <th className="px-3 py-2.5">Total Yield</th>
                  <th className="px-3 py-2.5">Avg Yield/Harvest</th>
                  <th className="px-3 py-2.5">Avg Trim Labor</th>
                  <th className="px-3 py-2.5">Min Trim Labor</th>
                  <th className="px-3 py-2.5">Max Trim Labor</th>
                  <th className="px-3 py-2.5">Avg Yield/Light</th>
                  <th className="px-3 py-2.5">Plants</th>
                  <th className="px-3 py-2.5">Avg Yield/Plant</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr
                    key={s.room}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-semibold text-gray-900">{s.room}</td>
                    <td className="px-3 py-2.5 text-gray-700">{s.harvests}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">
                      {s.totalYield.toFixed(2)} lbs
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{s.avgYield.toFixed(2)} lbs</td>
                    <td className="px-3 py-2.5 text-gray-700">{s.avgTrimLabor.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-gray-700">{s.minTrimLabor}</td>
                    <td className="px-3 py-2.5 text-gray-700">{s.maxTrimLabor}</td>
                    <td className="px-3 py-2.5 text-gray-700">
                      {s.avgYieldPerLight != null ? s.avgYieldPerLight.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{s.plants}</td>
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
