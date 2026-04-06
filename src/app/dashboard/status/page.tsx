"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { HarvestRecord, FacilityConfig, RoomConfig } from "@/lib/types";
import { daysDrying } from "@/lib/constants";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

type RowStatus = "completed" | "in-progress" | "upcoming";

function getRowStatus(r: HarvestRecord): RowStatus {
  if (r.trim_start_date && r.trim_end_date && r.labor_units > 0 && r.yield_lbs > 0) {
    return "completed";
  }
  if (r.trim_start_date || r.trim_end_date || r.labor_units > 0 || r.yield_lbs > 0 || r.dry_room_id) {
    return "in-progress";
  }
  return "upcoming";
}

function getStageName(r: HarvestRecord): string {
  const status = getRowStatus(r);
  if (status === "completed") return "Done";
  if (r.dry_room_id === "TRIM") return "Trimming";
  if (r.dry_room_id === "A" || r.dry_room_id === "B" || r.dry_room_id === "C") return "Drying";
  if (status === "in-progress") return "In Progress";
  return "Scheduled";
}

const STAGE_COLORS: Record<string, string> = {
  Done: "border-green-400 bg-green-50",
  Trimming: "border-blue-400 bg-blue-50",
  Drying: "border-amber-400 bg-amber-50",
  "In Progress": "border-yellow-400 bg-yellow-50",
  Scheduled: "border-gray-300 bg-white",
};

const STAGE_BADGE_COLORS: Record<string, string> = {
  Done: "bg-green-100 text-green-700",
  Trimming: "bg-blue-100 text-blue-700",
  Drying: "bg-amber-100 text-amber-800",
  "In Progress": "bg-yellow-100 text-yellow-700",
  Scheduled: "bg-gray-100 text-gray-500",
};

const DRY_ROOMS = ["A", "B", "C"] as const;

export default function StatusBoardPage() {
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

  const roomOrder = useMemo(() => {
    if (!config) return {} as Record<string, number>;
    const order: Record<string, number> = {};
    config.room_sequence.forEach((r: RoomConfig, i: number) => {
      order[r.room] = i;
    });
    return order;
  }, [config]);

  // Dry room capacity
  const dryRoomData = useMemo(() => {
    return DRY_ROOMS.map((roomId) => {
      const occupant = records.find(
        (r) =>
          r.dry_room_id === roomId &&
          getRowStatus(r) !== "completed"
      );
      const days = occupant ? daysDrying(occupant.trim_end_date) : null;
      return {
        id: roomId,
        label: `Dry Room ${roomId}`,
        occupant,
        days,
      };
    });
  }, [records]);

  // Cultivation rooms - latest record per room
  const cultivationRooms = useMemo(() => {
    if (!config) return [];
    return config.room_sequence.map((roomCfg: RoomConfig) => {
      const roomRecords = records
        .filter((r) => r.room_number === roomCfg.room)
        .sort((a, b) => b.cycle_number - a.cycle_number);
      const latest = roomRecords[0] || null;
      const seqIndex = roomOrder[roomCfg.room] ?? 0;
      let harvestDate: string | null = null;
      if (latest && config) {
        const dayOffset =
          ((latest.cycle_number - 1) * config.room_sequence.length + seqIndex) *
          config.rotation_interval_days;
        harvestDate = addDays(config.rotation_start_date, dayOffset);
      }
      return {
        room: roomCfg.room,
        record: latest,
        stage: latest ? getStageName(latest) : "Scheduled",
        cycle: latest?.cycle_number ?? null,
        harvestDate,
      };
    });
  }, [config, records, roomOrder]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Status Board</h1>

      {/* Dry Room Capacity */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dry Room Capacity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {dryRoomData.map((dr) => (
            <div
              key={dr.id}
              className={`rounded-xl shadow-sm p-5 border-l-4 ${
                dr.occupant
                  ? "border-l-amber-400 bg-white"
                  : "border-l-green-400 bg-white"
              }`}
            >
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{dr.label}</h3>
              {dr.occupant ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Room <span className="font-semibold">{dr.occupant.room_number}</span>{" "}
                    <span className="text-gray-400">/ Cycle {dr.occupant.cycle_number}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {dr.days != null ? `${dr.days} days drying` : "Drying in progress"}
                  </p>
                  {/* Progress bar out of 14 days */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-amber-400 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(((dr.days ?? 0) / 14) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">{dr.days ?? 0} / 14 days</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-green-600 font-medium">Available</p>
                  <p className="text-xs text-gray-400 mt-1">No harvest drying</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cultivation Rooms */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cultivation Rooms</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {cultivationRooms.map((room) => {
            const borderClass = STAGE_COLORS[room.stage] ?? STAGE_COLORS.Scheduled;
            const badgeClass = STAGE_BADGE_COLORS[room.stage] ?? STAGE_BADGE_COLORS.Scheduled;
            return (
              <div
                key={room.room}
                className={`rounded-xl shadow-sm p-4 border-l-4 ${borderClass}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-gray-900">{room.room}</span>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${badgeClass}`}>
                    {room.stage}
                  </span>
                </div>
                {room.cycle != null && (
                  <p className="text-xs text-gray-500">Cycle {room.cycle}</p>
                )}
                {room.harvestDate && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Harvest:{" "}
                    {new Date(room.harvestDate + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
