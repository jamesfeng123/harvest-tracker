export type UserRole = "admin" | "worker";

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export type HarvestStage = "upcoming" | "in-progress" | "completed";

export interface HarvestRecord {
  id: string;
  cycle_number: number;
  room_number: string;
  trim_start_date: string | null;
  trim_end_date: string | null;
  labor_units: number;
  yield_lbs: number;
  dry_room_id: string | null;
  stage: HarvestStage;
  created_at: string;
  updated_at: string;
}

export interface RoomConfig {
  room: string;
  plants: number;
  lights: number;
}

export interface FacilityConfig {
  id: string;
  rotation_start_date: string;
  rotation_interval_days: number;
  labor_rate: number;
  total_cycles: number;
  room_sequence: RoomConfig[];
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      harvest_records: {
        Row: HarvestRecord;
        Insert: Omit<HarvestRecord, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<HarvestRecord, "id" | "created_at" | "updated_at">>;
      };
      facility_config: {
        Row: FacilityConfig;
        Insert: Omit<FacilityConfig, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<FacilityConfig, "id" | "created_at" | "updated_at">>;
      };
    };
  };
}
