-- ─── Convert time_minutes from SMALLINT to SMALLINT[] ────────────────────────
-- Allows multiple time thresholds per favorite (e.g. notify at 10 min AND 2 min)

-- Drop the old scalar CHECK constraint and default
ALTER TABLE notification_settings DROP CONSTRAINT IF EXISTS notification_settings_time_minutes_check;
ALTER TABLE notification_settings ALTER COLUMN time_minutes DROP DEFAULT;

-- Convert column: wrap existing scalar value into a one-element array
ALTER TABLE notification_settings
  ALTER COLUMN time_minutes TYPE SMALLINT[]
  USING ARRAY[time_minutes];

-- New default: single-element array
ALTER TABLE notification_settings
  ALTER COLUMN time_minutes SET DEFAULT '{5}';

-- Validate: 1–5 elements, each between 1 and 30
-- (Postgres CHECK can't use subqueries, so we validate bounds with array_length
--  and rely on the API layer for per-element range checks)
ALTER TABLE notification_settings
  ADD CONSTRAINT notification_settings_time_minutes_check
  CHECK (
    array_length(time_minutes, 1) BETWEEN 1 AND 5
  );
