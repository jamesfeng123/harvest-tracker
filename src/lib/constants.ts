import { RoomConfig } from "./types";

export const DEFAULT_ROOM_SEQUENCE: RoomConfig[] = [
  { room: "113", plants: 0, lights: 0 },
  { room: "106", plants: 0, lights: 0 },
  { room: "109", plants: 0, lights: 0 },
  { room: "112", plants: 0, lights: 0 },
  { room: "107", plants: 0, lights: 0 },
  { room: "105", plants: 0, lights: 0 },
  { room: "104", plants: 0, lights: 0 },
  { room: "111", plants: 0, lights: 0 },
  { room: "102", plants: 0, lights: 0 },
  { room: "114", plants: 0, lights: 0 },
  { room: "110", plants: 0, lights: 0 },
  { room: "103", plants: 0, lights: 0 },
];

export const DEFAULT_ROTATION_INTERVAL = 5;
export const DEFAULT_LABOR_RATE = 210;
export const DEFAULT_TOTAL_CYCLES = 10;

export function computeStage(
  trimStartDate: string | null,
  trimEndDate: string | null
): "upcoming" | "in-progress" | "completed" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!trimStartDate) return "upcoming";

  const start = new Date(trimStartDate + "T00:00:00");
  if (start > today) return "upcoming";

  if (trimEndDate) {
    const end = new Date(trimEndDate + "T00:00:00");
    if (end <= today) return "completed";
  }

  return "in-progress";
}

export function daysDrying(trimEndDate: string | null): number | null {
  if (!trimEndDate) return null;
  const end = new Date(trimEndDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}
