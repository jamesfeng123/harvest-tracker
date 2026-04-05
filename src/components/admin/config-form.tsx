"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FacilityConfig, RoomConfig } from "@/lib/types";

export function ConfigForm({ config }: { config: FacilityConfig }) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [formData, setFormData] = useState({
    rotation_start_date: config.rotation_start_date,
    rotation_interval_days: config.rotation_interval_days,
    labor_rate: config.labor_rate,
    total_cycles: config.total_cycles,
    room_sequence: config.room_sequence.map((r) => ({
      room: r.room,
      plants: r.plants ?? 0,
      lights: r.lights ?? 0,
    })),
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  }

  function handleRoomChange(
    index: number,
    field: keyof RoomConfig,
    value: string | number
  ) {
    setFormData((prev) => {
      const rooms = [...prev.room_sequence];
      rooms[index] = { ...rooms[index], [field]: value };
      return { ...prev, room_sequence: rooms };
    });
  }

  function addRoom() {
    setFormData((prev) => ({
      ...prev,
      room_sequence: [...prev.room_sequence, { room: "", plants: 0, lights: 0 }],
    }));
  }

  function removeRoom(index: number) {
    setFormData((prev) => ({
      ...prev,
      room_sequence: prev.room_sequence.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const { error: updateError } = await supabase
      .from("facility_config")
      .update({
        rotation_start_date: formData.rotation_start_date,
        rotation_interval_days: formData.rotation_interval_days,
        labor_rate: formData.labor_rate,
        total_cycles: formData.total_cycles,
        room_sequence: formData.room_sequence,
      })
      .eq("id", config.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  }

  async function generateRecords() {
    setGenerating(true);
    setError(null);

    const rooms = formData.room_sequence;
    const startDate = new Date(formData.rotation_start_date + "T00:00:00");
    const records = [];

    for (let cycle = 1; cycle <= formData.total_cycles; cycle++) {
      for (let roomIdx = 0; roomIdx < rooms.length; roomIdx++) {
        const dayOffset =
          (cycle - 1) * rooms.length * formData.rotation_interval_days +
          roomIdx * formData.rotation_interval_days;
        const trimStart = new Date(startDate);
        trimStart.setDate(trimStart.getDate() + dayOffset);

        records.push({
          cycle_number: cycle,
          room_number: rooms[roomIdx].room,
          trim_start_date: trimStart.toISOString().split("T")[0],
          trim_end_date: null,
          labor_units: 0,
          yield_lbs: 0,
          dry_room_id: null,
          stage: "upcoming" as const,
        });
      }
    }

    const { error: insertError } = await supabase
      .from("harvest_records")
      .insert(records);

    setGenerating(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4 max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900">Rotation Settings</h2>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 p-3 rounded text-sm">
            Saved successfully.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rotation Start Date
            </label>
            <input
              type="date"
              name="rotation_start_date"
              value={formData.rotation_start_date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rotation Interval (days)
            </label>
            <input
              type="number"
              name="rotation_interval_days"
              value={formData.rotation_interval_days}
              onChange={handleChange}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Labor Rate ($)
            </label>
            <input
              type="number"
              name="labor_rate"
              value={formData.labor_rate}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Cycles
            </label>
            <input
              type="number"
              name="total_cycles"
              value={formData.total_cycles}
              onChange={handleChange}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Room Sequence</h3>
            <button
              type="button"
              onClick={addRoom}
              className="text-xs text-green-600 hover:text-green-800 font-medium"
            >
              + Add Room
            </button>
          </div>
          <div className="space-y-2">
            {formData.room_sequence.map((room, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-6">{idx + 1}.</span>
                <input
                  type="text"
                  value={room.room}
                  onChange={(e) => handleRoomChange(idx, "room", e.target.value)}
                  placeholder="Room #"
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  value={room.plants}
                  onChange={(e) =>
                    handleRoomChange(idx, "plants", parseInt(e.target.value) || 0)
                  }
                  placeholder="Plants"
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  value={room.lights}
                  onChange={(e) =>
                    handleRoomChange(idx, "lights", parseInt(e.target.value) || 0)
                  }
                  placeholder="Lights"
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => removeRoom(idx)}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
          >
            {saving ? "Saving..." : "Save Config"}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Generate Harvest Records
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Generate harvest records for all cycles and rooms based on the current
          configuration. This will add new records without removing existing ones.
        </p>
        <button
          onClick={generateRecords}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
        >
          {generating ? "Generating..." : "Generate Records"}
        </button>
      </div>
    </div>
  );
}
