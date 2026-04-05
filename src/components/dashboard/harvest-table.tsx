"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HarvestRecord, Profile } from "@/lib/types";
import { computeStage, daysDrying } from "@/lib/constants";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const STAGE_COLORS: Record<string, string> = {
  upcoming: "bg-blue-100 text-blue-800",
  "in-progress": "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
};

export function HarvestTable({ profile }: { profile: Profile }) {
  const [records, setRecords] = useState<HarvestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const supabase = createClient();

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
            // Flash indicator for remote updates
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
                    <th className="px-4 py-2 font-medium">Trim Start</th>
                    <th className="px-4 py-2 font-medium">Trim End</th>
                    <th className="px-4 py-2 font-medium">Labor Units</th>
                    <th className="px-4 py-2 font-medium">Yield (lbs)</th>
                    <th className="px-4 py-2 font-medium">Dry Room</th>
                    <th className="px-4 py-2 font-medium">Days Drying</th>
                    <th className="px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cycleRecords.map((record) => {
                    const stage = computeStage(
                      record.trim_start_date,
                      record.trim_end_date
                    );
                    const drying = daysDrying(record.trim_end_date);
                    const isUpdated = recentlyUpdated.has(record.id);

                    return (
                      <tr
                        key={record.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          isUpdated ? "bg-yellow-50 ring-2 ring-yellow-300 ring-inset" : ""
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
                        <td className="px-4 py-2">{record.trim_start_date ?? "—"}</td>
                        <td className="px-4 py-2">{record.trim_end_date ?? "—"}</td>
                        <td className="px-4 py-2">{record.labor_units}</td>
                        <td className="px-4 py-2">{record.yield_lbs}</td>
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
