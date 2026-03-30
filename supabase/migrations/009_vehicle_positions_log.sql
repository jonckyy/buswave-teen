-- ─── Vehicle positions recording for analysis ────────────────────────────────
-- Records positions every 10s for selected lines (30-40, 50, 366)
-- Retained for 7 days, cleaned up hourly by the API

CREATE TABLE vehicle_positions_log (
  id            BIGSERIAL PRIMARY KEY,
  vehicle_id    TEXT NOT NULL,
  route_id      TEXT NOT NULL,
  route_short   TEXT NOT NULL,
  trip_id       TEXT NOT NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lon           DOUBLE PRECISION NOT NULL,
  bearing       SMALLINT,
  speed         SMALLINT,
  delay_seconds INTEGER,
  stop_id       TEXT,
  stop_sequence SMALLINT,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Analysis queries: filter by line + time range
CREATE INDEX vpl_route_short_recorded ON vehicle_positions_log(route_short, recorded_at);
-- Cleanup: delete old records
CREATE INDEX vpl_recorded_at ON vehicle_positions_log(recorded_at);
-- Per-vehicle tracking
CREATE INDEX vpl_vehicle_recorded ON vehicle_positions_log(vehicle_id, recorded_at);
