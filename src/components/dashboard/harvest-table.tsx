"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HarvestRecord, RoomConfig } from "@/lib/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// ─── Helpers ───

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(value: number): string {
  return (
    "$" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

function formatCurrencyDecimal(value: number): string {
  return (
    "$" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

type RowStatus = "completed" | "in-progress" | "upcoming";

function getRowStatus(r: HarvestRecord, dryRoom: string | null): RowStatus {
  if (r.trim_start_date && r.trim_end_date && r.labor_units > 0 && r.yield_lbs > 0) {
    return "completed";
  }
  if (r.trim_start_date || r.trim_end_date || r.labor_units > 0 || r.yield_lbs > 0 || dryRoom) {
    return "in-progress";
  }
  return "upcoming";
}

const ROW_BG: Record<RowStatus, string> = {
  upcoming: "",
  "in-progress": "bg-yellow-50",
  completed: "bg-green-50",
};

// ─── Types ───

interface EnrichedRow {
  record: HarvestRecord;
  seq: number;
  harvestDate: string;
  plants: number;
  lights: number;
  rowStatus: RowStatus;
  laborCost: number;
  costPerLb: number | null;
  yieldPerLight: number | null;
  yieldPerPlant: number | null;
}

interface HarvestTableProps {
  laborRate: number;
  roomSequence: RoomConfig[];
  facilityConfig: {
    rotationStartDate: string;
    rotationInterval: number;
    totalCycles: number;
  };
}

// ─── Component ───

export function HarvestTable({
  laborRate,
  roomSequence,
  facilityConfig,
}: HarvestTableProps) {
  const router = useRouter();
  const [records, setRecords] = useState<HarvestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(
    new Set()
  );
  const supabase = createClient();

  const roomMap = useMemo(() => {
    const map: Record<string, RoomConfig> = {};
    for (const r of roomSequence) map[r.room] = r;
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
        { event: "*", schema: "public", table: "harvest_records" },
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

  // ─── Enrich rows ───
  const enrichedRows: EnrichedRow[] = useMemo(() => {
    return records.map((record) => {
      const seqIndex = roomOrder[record.room_number] ?? 0;
      const seq = seqIndex + 1;
      const dayOffset =
        ((record.cycle_number - 1) * roomSequence.length + seqIndex) *
        facilityConfig.rotationInterval;
      const harvestDate = addDays(
        facilityConfig.rotationStartDate,
        dayOffset
      );
      const room = roomMap[record.room_number];
      const plants = room?.plants ?? 0;
      const lights = room?.lights ?? 0;
      const rowStatus = getRowStatus(record, record.dry_room_id);
      const laborCost = record.labor_units * laborRate;
      const costPerLb =
        record.yield_lbs > 0 ? laborCost / record.yield_lbs : null;
      const yieldPerLight =
        lights > 0 && record.yield_lbs > 0
          ? record.yield_lbs / lights
          : null;
      const yieldPerPlant =
        plants > 0 && record.yield_lbs > 0
          ? record.yield_lbs / plants
          : null;

      return {
        record,
        seq,
        harvestDate,
        plants,
        lights,
        rowStatus,
        laborCost,
        costPerLb,
        yieldPerLight,
        yieldPerPlant,
      };
    });
  }, [
    records,
    roomSequence,
    roomOrder,
    roomMap,
    facilityConfig.rotationStartDate,
    facilityConfig.rotationInterval,
    laborRate,
  ]);

  // Sort: cycle asc, then seq asc
  const sortedRows = useMemo(() => {
    return [...enrichedRows].sort((a, b) => {
      if (a.record.cycle_number !== b.record.cycle_number)
        return a.record.cycle_number - b.record.cycle_number;
      return a.seq - b.seq;
    });
  }, [enrichedRows]);

  // ─── KPI ───
  const kpi = useMemo(() => {
    const completed = enrichedRows.filter((r) => r.rowStatus === "completed");
    const totalYield = completed.reduce(
      (sum, r) => sum + r.record.yield_lbs,
      0
    );
    const totalLaborCost = completed.reduce((sum, r) => sum + r.laborCost, 0);
    const avgCostPerLb = totalYield > 0 ? totalLaborCost / totalYield : 0;
    return {
      totalYield,
      totalLaborCost,
      avgCostPerLb,
      count: completed.length,
    };
  }, [enrichedRows]);

  const totalExpected =
    facilityConfig.totalCycles * roomSequence.length;

  // ─── CSV Export ───
  function exportCSV() {
    const headers = [
      "Cycle",
      "Seq",
      "Room",
      "Plants",
      "Lights",
      "Harvest Date",
      "Location",
      "Trim Start",
      "Trim End",
      "Labor",
      "Yield (lbs)",
      "Labor Cost",
      "Cost/lb",
      "Yield/Light",
      "Yield/Plant",
    ];
    const csvRows = [headers.join(",")];
    sortedRows.forEach((row) => {
      const r = row.record;
      const locationLabel = getLocationLabel(r, row.rowStatus);
      csvRows.push(
        [
          r.cycle_number,
          row.seq,
          r.room_number,
          row.plants,
          row.lights,
          row.harvestDate,
          locationLabel,
          r.trim_start_date || "",
          r.trim_end_date || "",
          r.labor_units || "",
          r.yield_lbs || "",
          row.laborCost || "",
          row.costPerLb != null ? row.costPerLb.toFixed(2) : "",
          row.yieldPerLight != null ? row.yieldPerLight.toFixed(2) : "",
          row.yieldPerPlant != null ? row.yieldPerPlant.toFixed(4) : "",
        ].join(",")
      );
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "harvest_schedule.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Location helpers ───
  function getLocationLabel(r: HarvestRecord, status: RowStatus): string {
    if (status === "completed") return "Done";
    if (r.dry_room_id === "TRIM") return "Trim Room";
    if (r.dry_room_id === "A") return "Dry Room A";
    if (r.dry_room_id === "B") return "Dry Room B";
    if (r.dry_room_id === "C") return "Dry Room C";
    return "Scheduled";
  }

  function LocationBadge({
    record,
    status,
  }: {
    record: HarvestRecord;
    status: RowStatus;
  }) {
    if (status === "completed") {
      return (
        <span className="px-1.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded">
          Done
        </span>
      );
    }
    if (record.dry_room_id === "TRIM") {
      return (
        <span className="px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
          Trim Room
        </span>
      );
    }
    if (
      record.dry_room_id === "A" ||
      record.dry_room_id === "B" ||
      record.dry_room_id === "C"
    ) {
      return (
        <span className="px-1.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded">
          Dry Room {record.dry_room_id}
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500 rounded">
        Scheduled
      </span>
    );
  }

  // ─── Render ───

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
        <p className="text-sm mt-1">
          Records will appear here once created.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      {kpi.count > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Yield</p>
            <p className="text-2xl font-bold text-gray-900">
              {kpi.totalYield.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              lbs
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

      {/* Header: subtitle + CSV Export */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Click any row to log harvest data. {kpi.count} of {totalExpected}{" "}
          completed.
        </p>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Flat Harvest Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <th className="px-3 py-2">Cycle</th>
                <th className="px-3 py-2">Seq</th>
                <th className="px-3 py-2">Room</th>
                <th className="px-3 py-2">Plants</th>
                <th className="px-3 py-2">Lights</th>
                <th className="px-3 py-2">Harvest Date</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Trim Start</th>
                <th className="px-3 py-2">Trim End</th>
                <th className="px-3 py-2">Labor</th>
                <th className="px-3 py-2">Yield (lbs)</th>
                <th className="px-3 py-2">Labor Cost</th>
                <th className="px-3 py-2">Cost/lb</th>
                <th className="px-3 py-2">Yield/Light</th>
                <th className="px-3 py-2">Yield/Plant</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const r = row.record;
                const isUpdated = recentlyUpdated.has(r.id);

                return (
                  <tr
                    key={r.id}
                    onClick={() =>
                      router.push(`/dashboard/record/${r.id}`)
                    }
                    className={`border-b border-gray-100 hover:brightness-95 transition-colors cursor-pointer ${ROW_BG[row.rowStatus]} ${
                      isUpdated ? "ring-2 ring-yellow-300 ring-inset" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {r.cycle_number}
                      {isUpdated && (
                        <span
                          className="ml-2 inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"
                          title="Recently updated"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{row.seq}</td>
                    <td className="px-3 py-2 font-semibold text-gray-900">
                      {r.room_number}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {row.plants}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {row.lights}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {fmtDate(row.harvestDate)}
                    </td>
                    <td className="px-3 py-2">
                      <LocationBadge
                        record={r}
                        status={row.rowStatus}
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {fmtDate(r.trim_start_date)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {fmtDate(r.trim_end_date)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {r.labor_units > 0 ? r.labor_units : "—"}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {r.yield_lbs > 0 ? r.yield_lbs : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {row.laborCost > 0
                        ? formatCurrency(row.laborCost)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {row.costPerLb != null
                        ? formatCurrencyDecimal(row.costPerLb)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {row.yieldPerLight != null
                        ? row.yieldPerLight.toFixed(2)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {row.yieldPerPlant != null
                        ? row.yieldPerPlant.toFixed(4)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-300" />{" "}
          Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />{" "}
          In Progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-100 border border-gray-300" />{" "}
          Upcoming
        </span>
      </div>
    </div>
  );
}
