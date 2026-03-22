-- ══════════════════════════════════════════════════════════════
--  BusWave — RLS policies for public GTFS read access
-- ══════════════════════════════════════════════════════════════

-- GTFS static tables are public read-only data — anyone can SELECT
alter table routes enable row level security;
alter table stops enable row level security;
alter table trips enable row level security;
alter table stop_times enable row level security;
alter table shapes enable row level security;
alter table calendar enable row level security;
alter table alert_logs enable row level security;

create policy "Public read access" on routes for select using (true);
create policy "Public read access" on stops for select using (true);
create policy "Public read access" on trips for select using (true);
create policy "Public read access" on stop_times for select using (true);
create policy "Public read access" on shapes for select using (true);
create policy "Public read access" on calendar for select using (true);
create policy "Public read access" on alert_logs for select using (true);
