-- ══════════════════════════════════════════════════════════════
--  BusWave — Supabase schema
--  Run via: supabase db push  OR  paste into SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Enable pg_trgm for fuzzy full-text search
create extension if not exists pg_trgm;

-- ── GTFS Static ────────────────────────────────────────────────

create table if not exists routes (
  route_id          text primary key,
  agency_id         text,
  route_short_name  text not null,
  route_long_name   text not null,
  route_type        integer not null default 3,
  route_color       text,
  route_text_color  text,
  -- Full-text search vector (updated via trigger)
  fts               tsvector generated always as (
    to_tsvector('french', route_short_name || ' ' || route_long_name)
  ) stored
);

create index if not exists routes_fts_idx on routes using gin(fts);
create index if not exists routes_short_name_idx on routes using gin(route_short_name gin_trgm_ops);

create table if not exists stops (
  stop_id         text primary key,
  stop_name       text not null,
  stop_lat        double precision not null,
  stop_lon        double precision not null,
  stop_code       text,
  location_type   integer default 0,
  parent_station  text,
  fts             tsvector generated always as (
    to_tsvector('french', stop_name)
  ) stored
);

create index if not exists stops_fts_idx on stops using gin(fts);
create index if not exists stops_name_trgm_idx on stops using gin(stop_name gin_trgm_ops);

create table if not exists trips (
  trip_id       text primary key,
  route_id      text not null references routes(route_id) on delete cascade,
  service_id    text not null,
  trip_headsign text,
  direction_id  smallint check (direction_id in (0, 1)),
  shape_id      text
);

create index if not exists trips_route_id_idx on trips(route_id);
create index if not exists trips_shape_id_idx on trips(shape_id);

create table if not exists stop_times (
  trip_id              text not null references trips(trip_id) on delete cascade,
  stop_id              text not null references stops(stop_id) on delete cascade,
  stop_sequence        integer not null,
  arrival_time         text not null,
  departure_time       text not null,
  shape_dist_traveled  double precision,
  primary key (trip_id, stop_sequence)
);

create index if not exists stop_times_stop_id_idx on stop_times(stop_id);

create table if not exists shapes (
  shape_id             text not null,
  shape_pt_lat         double precision not null,
  shape_pt_lon         double precision not null,
  shape_pt_sequence    integer not null,
  shape_dist_traveled  double precision,
  primary key (shape_id, shape_pt_sequence)
);

create index if not exists shapes_shape_id_idx on shapes(shape_id);

create table if not exists calendar (
  service_id  text primary key,
  monday      boolean not null,
  tuesday     boolean not null,
  wednesday   boolean not null,
  thursday    boolean not null,
  friday      boolean not null,
  saturday    boolean not null,
  sunday      boolean not null,
  start_date  text not null,
  end_date    text not null
);

-- ── User Favorites ─────────────────────────────────────────────

create table if not exists favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  stop_id     text not null references stops(stop_id) on delete cascade,
  route_id    text references routes(route_id) on delete set null,
  label       text,
  created_at  timestamptz not null default now()
);

create index if not exists favorites_user_id_idx on favorites(user_id);
create index if not exists favorites_stop_id_idx on favorites(stop_id);

-- Row-level security: users can only see/modify their own favorites
alter table favorites enable row level security;

create policy "Users can manage their own favorites"
  on favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Alert Logs (optional history) ─────────────────────────────

create table if not exists alert_logs (
  id                  uuid primary key default gen_random_uuid(),
  alert_id            text not null,
  cause               text,
  effect              text,
  header_text         text not null,
  description_text    text,
  active_period_start timestamptz,
  active_period_end   timestamptz,
  route_ids           text[] default '{}',
  stop_ids            text[] default '{}',
  recorded_at         timestamptz not null default now()
);

create index if not exists alert_logs_alert_id_idx on alert_logs(alert_id);
create index if not exists alert_logs_recorded_at_idx on alert_logs(recorded_at desc);
