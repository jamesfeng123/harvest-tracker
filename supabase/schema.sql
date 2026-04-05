-- ============================================
-- Harvest Tracker — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Enable required extensions
create extension if not exists "uuid-ossp";

-- 2. Profiles table (linked to auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  role text not null default 'worker' check (role in ('admin', 'worker')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'worker');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Facility configuration table
create table public.facility_config (
  id uuid primary key default uuid_generate_v4(),
  rotation_start_date date not null default current_date,
  rotation_interval_days integer not null default 5,
  labor_rate numeric(10,2) not null default 210.00,
  total_cycles integer not null default 10,
  room_sequence jsonb not null default '[
    {"room": "113", "plants": 0, "lights": 0},
    {"room": "106", "plants": 0, "lights": 0},
    {"room": "109", "plants": 0, "lights": 0},
    {"room": "112", "plants": 0, "lights": 0},
    {"room": "107", "plants": 0, "lights": 0},
    {"room": "105", "plants": 0, "lights": 0},
    {"room": "104", "plants": 0, "lights": 0},
    {"room": "111", "plants": 0, "lights": 0},
    {"room": "102", "plants": 0, "lights": 0},
    {"room": "114", "plants": 0, "lights": 0},
    {"room": "110", "plants": 0, "lights": 0},
    {"room": "103", "plants": 0, "lights": 0}
  ]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insert default config row
insert into public.facility_config (rotation_start_date, rotation_interval_days, labor_rate, total_cycles)
values (current_date, 5, 210.00, 10);

-- 4. Harvest records table
create table public.harvest_records (
  id uuid primary key default uuid_generate_v4(),
  cycle_number integer not null,
  room_number text not null,
  trim_start_date date,
  trim_end_date date,
  labor_units numeric(10,2) default 0,
  yield_lbs numeric(10,2) default 0,
  dry_room_id text,
  stage text not null default 'upcoming' check (stage in ('upcoming', 'in-progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast lookups
create index idx_harvest_records_cycle on public.harvest_records (cycle_number);
create index idx_harvest_records_room on public.harvest_records (room_number);

-- Auto-update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_harvest_records_updated_at
  before update on public.harvest_records
  for each row execute function public.update_updated_at();

create trigger set_facility_config_updated_at
  before update on public.facility_config
  for each row execute function public.update_updated_at();

-- ============================================
-- 5. Row Level Security
-- ============================================

alter table public.profiles enable row level security;
alter table public.harvest_records enable row level security;
alter table public.facility_config enable row level security;

-- Profiles: users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Profiles: admins can read all profiles
create policy "Admins can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Profiles: admins can update any profile
create policy "Admins can update profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Harvest records: all authenticated users can read
create policy "Authenticated users can read harvest_records"
  on public.harvest_records for select
  using (auth.role() = 'authenticated');

-- Harvest records: all authenticated users can insert
create policy "Authenticated users can insert harvest_records"
  on public.harvest_records for insert
  with check (auth.role() = 'authenticated');

-- Harvest records: all authenticated users can update
create policy "Authenticated users can update harvest_records"
  on public.harvest_records for update
  using (auth.role() = 'authenticated');

-- Harvest records: only admins can delete
create policy "Admins can delete harvest_records"
  on public.harvest_records for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Facility config: all authenticated users can read
create policy "Authenticated users can read facility_config"
  on public.facility_config for select
  using (auth.role() = 'authenticated');

-- Facility config: only admins can update
create policy "Admins can update facility_config"
  on public.facility_config for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Facility config: only admins can insert
create policy "Admins can insert facility_config"
  on public.facility_config for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- 6. Enable Realtime on harvest_records
-- ============================================
alter publication supabase_realtime add table public.harvest_records;
