"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HarvestRecord, Profile, RoomConfig } from "@/lib/types";
import { computeStage, daysDrying } from "@/lib/constants";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const STAGE_COLORS: Record<string, string> = {
  upcoming: "bg-blue-100 text-blue-800",
  "in-progress": "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
};

const ROW_BG: Record<string, string> = {
  upcoming: "bg-gray-50",
  "in-progress": "bg-yellow-50",
  completed: "bg-green-50",
};

function formatCurrency(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatCurrencyDecimal(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface HarvestTableProps {
  profile: Profile;
  laborRate: number;
  roomSequence: RoomConfig[];
}

export function HarvestTable({ profile, laborRate, roomSequence }: HarvestTableProps) {
  const [records, setRecords] = useState<HarvestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const supabase = createClient();

  const roomMap = useMemo(() => {
    const map: Record<string, RoomConfig> = {};
    for (const r of roomSequence) {
      map[r.room] = r;
    }
    return map;
  }, [roomSequence]);

  const roomOrder = useMemo(() => {
    const order: Record<string, number> = {};
    roomSequence.forEach((r, i) => {
      order[r.room] = i;
    });
    return order;
  }, [roomSequence]);

  const fetchRecords = useCallback(async () => {
    const { data } = await supabase
      .from("harvest_records")
      .select("*")
      .order("cycle_number", { ascending: true })
      .order("room_number", { ascending: true });
    if (data) setRecords(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    const channel = supabase
      .channel("harvest-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "harvest_records",
        },
        (payload: RealtimePostgresChangesPayload<HarvestRecord>) => {
          if (payload.eventType === "INSERT") {
            setRecords((prev) => [...prev, payload.new as HarvestRecord]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as HarvestRecord;
            setRecords((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
            setRecentlyUpdated((prev) => new Set(prev).add(updated.id));
            setTimeout(() => {
              setRecentlyUpdated((prev) => {
                const next = new Set(prev);
                next.delete(updated.id);
                return next;
              });
            }, 3000);
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setRecords((prev) => prev.filter((r) => r.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const kpi = useMemo(() => {
    const completed = records.filter(
      (r) => computeStage(r.trim_start_date, r.trim_end_date) === "completed"
    );
    const totalYield = completed.reduce((sum, r) => sum + r.yield_lbs, 0);
    const totalLaborCost = completed.reduce(
      (sum, r) => sum + r.labor_units * laborRate,
      0
    );
    const avgCostPerLb = totalYield > 0 ? totalLaborCost / totalYield : 0;
    return { totalYield, totalLaborCost, avgCostPerLb, count: completed.length };
  }, [records, laborRate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No harvest records yet.</p>
        <p className="text-sm mt-1">Records will appear here once created.</p>
      </div>
    );
  }

  // Group by cycle
  const cycles = records.reduce<Record<number, HarvestRecord[]>>((acc, r) => {
    if (!acc[r.cycle_number]) acc[r.cycle_number] = [];
    acc[r.cycle_number].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* KPI Summary Cards */}
      {kpi.count > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Yield</p>
            <p className="text-2xl font-bold text-gray-900">
              {kpi.totalYield.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lbs
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Labor Cost</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(kpi.totalLaborCost)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Average Cost/lb</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrencyDecimal(kpi.avgCostPerLb)}
            </p>
          </div>
        </div>
      )}

      {Object.entries(cycles)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([cycle, cycleRecords]) => (
          <div key={cycle} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-green-700 px-4 py-2">
              <h2 className="text-white font-semibold">Cycle {cycle}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-4 py-2 font-medium">Room</th>
                    <th className="px-4 py-2 font-medium">Stage</th>
                    <th className="px-4 py-2 font-medium">Plants</th>
                    <th className="px-4 py-2 font-medium">Lights</th>
                    <th className="px-4 py-2 font-medium">Trim Start</th>
                    <th className="px-4 py-2 font-medium">Trim End</th>
                    <th className="px-4 py-2 font-medium">Labor Units</th>
                    <th className="px-4 py-2 font-medium">Yield (lbs)</th>
                    <th className="px-4 py-2 font-medium">Labor Cost</th>
                    <th className="px-4 py-2 font-medium">Cost/lb</th>
                    <th className="px-4 py-2 font-medium">Yield/Light</th>
                    <th className="px-4 py-2 font-medium">Yield/Plant</th>
                    <th className="px-4 py-2 font-medium">Dry Room</th>
                    <th className="px-4 py-2 font-medium">Days Drying</th>
                    <th className="px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cycleRecords
                  .slice()
                  .sort((a, b) => (roomOrder[a.room_number] ?? Infinity) - (roomOrder[b.room_number] ?? Infinity))
                  .map((record) => {
                    const stage = computeStage(
                      record.trim_start_date,
                      record.trim_end_date
                    );
                    const drying = daysDrying(record.trim_end_date);
                    const isUpdated = recentlyUpdated.has(record.id);
                    const room = roomMap[record.room_number];
                    const plants = room?.plants ?? 0;
                    const lights = room?.lights ?? 0;
                    const laborCost = record.labor_units * laborRate;
                    const costPerLb = record.yield_lbs > 0 ? laborCost / record.yield_lbs : 0;
                    const yieldPerLight = lights > 0 ? record.yield_lbs / lights : 0;
                    const yieldPerPlant = plants > 0 ? record.yield_lbs / plants : 0;

                    return (
                      <tr
                        key={record.id}
                        className={`${ROW_BG[stage]} hover:brightness-95 transition-colors ${
                          isUpdated ? "ring-2 ring-yellow-300 ring-inset" : ""
                        }`}
                      >
                        <td className="px-4 py-2 font-medium">
                          {record.room_number}
                          {isUpdated && (
                            <span className="ml-2 inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" title="Recently updated by another user" />
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[stage]}`}
                          >
                            {stage}
                          </span>
                        </td>
                        <td className="px-4 py-2">{plants}</td>
                        <td className="px-4 py-2">{lights}</td>
                        <td className="px-4 py-2">{record.trim_start_date ?? "—"}</td>
                        <td className="px-4 py-2">{record.trim_end_date ?? "—"}</td>
                        <td className="px-4 py-2">{record.labor_units}</td>
                        <td className="px-4 py-2">{record.yield_lbs}</td>
                        <td className="px-4 py-2">{formatCurrency(laborCost)}</td>
                        <td className="px-4 py-2">{record.yield_lbs > 0 ? formatCurrencyDecimal(costPerLb) : "—"}</td>
                        <td className="px-4 py-2">{lights > 0 ? yieldPerLight.toFixed(2) : "—"}</td>
                        <td className="px-4 py-2">{plants > 0 ? yieldPerPlant.toFixed(4) : "—"}</td>
                        <td className="px-4 py-2">{record.dry_room_id ?? "—"}</td>
                        <td className="px-4 py-2">
                          {drying !== null ? `${drying}d` : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <Link
                            href={`/dashboard/record/${record.id}`}
                            className="text-green-600 hover:text-green-800 font-medium text-xs"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
}
