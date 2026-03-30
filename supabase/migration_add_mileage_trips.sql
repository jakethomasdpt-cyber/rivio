-- ============================================================================
-- Migration: add mileage_trips table for automatic Bluetooth-triggered tracking
-- Run this once in the Supabase SQL Editor
-- ============================================================================

create table if not exists public.mileage_trips (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  start_address text not null default '',
  end_address   text not null default '',
  start_lat     float8,
  start_lng     float8,
  end_lat       float8,
  end_lng       float8,
  miles         numeric(10, 2) not null,
  purpose       text,
  irs_deduction numeric(10, 2) not null,
  created_at    timestamptz not null default now()
);

-- Enable RLS
alter table public.mileage_trips enable row level security;

-- Policy: users can only see and manage their own trips
create policy "Users can view own mileage trips"
  on public.mileage_trips for select
  using (auth.uid() = user_id);

create policy "Users can insert own mileage trips"
  on public.mileage_trips for insert
  with check (auth.uid() = user_id);

create policy "Users can update own mileage trips"
  on public.mileage_trips for update
  using (auth.uid() = user_id);

create policy "Users can delete own mileage trips"
  on public.mileage_trips for delete
  using (auth.uid() = user_id);

-- Index for fast user+date queries
create index if not exists mileage_trips_user_date_idx
  on public.mileage_trips (user_id, date desc);
