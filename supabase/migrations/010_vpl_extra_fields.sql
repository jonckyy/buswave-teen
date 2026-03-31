-- ─── Add extra analysis fields to vehicle_positions_log ───────────────────────

ALTER TABLE vehicle_positions_log
  ADD COLUMN IF NOT EXISTS vehicle_timestamp BIGINT,
  ADD COLUMN IF NOT EXISTS direction_id SMALLINT,
  ADD COLUMN IF NOT EXISTS schedule_relationship SMALLINT,
  ADD COLUMN IF NOT EXISTS congestion_level SMALLINT,
  ADD COLUMN IF NOT EXISTS occupancy_status SMALLINT;
