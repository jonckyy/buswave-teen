-- ─── Convert time_minutes from SMALLINT to SMALLINT[] ────────────────────────
-- Allows multiple time thresholds per favorite (e.g. notify at 10 min AND 2 min)

-- Drop the old scalar CHECK constraint
ALTER TABLE notification_settings DROP CONSTRAINT IF EXISTS notification_settings_time_minutes_check;

-- Convert column: wrap existing scalar value into a one-element array
ALTER TABLE notification_settings
  ALTER COLUMN time_minutes TYPE SMALLINT[]
  USING ARRAY[time_minutes];

-- New default: single-element array
ALTER TABLE notification_settings
  ALTER COLUMN time_minutes SET DEFAULT '{5}';

-- Validate: each element 1–30, max 5 elements
ALTER TABLE notification_settings
  ADD CONSTRAINT notification_settings_time_minutes_check
  CHECK (
    array_length(time_minutes, 1) IS NOT NULL
    AND array_length(time_minutes, 1) <= 5
    AND time_minutes <@ (SELECT array_agg(g::SMALLINT) FROM generate_series(1, 30) g)
  );
