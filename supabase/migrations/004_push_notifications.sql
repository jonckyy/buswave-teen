-- Push notification infrastructure: subscriptions, per-favorite settings, dedup log
-- Also adds quiet hours to profiles

-- ─── Quiet hours on profiles ─────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS quiet_start TIME NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_end   TIME NOT NULL DEFAULT '07:00';

-- ─── Push subscriptions (Web Push API endpoints per device) ──────────────────

CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used  TIMESTAMPTZ
);

CREATE INDEX push_subscriptions_user_id_idx ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_subscriptions"
  ON push_subscriptions FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ─── Notification settings (per-favorite trigger configuration) ──────────────

CREATE TABLE notification_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  favorite_id      UUID NOT NULL REFERENCES favorites(id) ON DELETE CASCADE UNIQUE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Time alert: notify when bus <= X minutes away
  time_enabled     BOOLEAN NOT NULL DEFAULT false,
  time_minutes     SMALLINT NOT NULL DEFAULT 5 CHECK (time_minutes BETWEEN 1 AND 30),

  -- Distance alert: notify when bus <= X meters away
  distance_enabled BOOLEAN NOT NULL DEFAULT false,
  distance_meters  SMALLINT NOT NULL DEFAULT 500 CHECK (distance_meters BETWEEN 100 AND 2000),

  -- Off-route alert: notify when bus deviates > threshold from shape
  offroute_enabled BOOLEAN NOT NULL DEFAULT false,
  offroute_meters  SMALLINT NOT NULL DEFAULT 150 CHECK (offroute_meters BETWEEN 50 AND 500),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notification_settings_user_id_idx ON notification_settings(user_id);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_notification_settings"
  ON notification_settings FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Reuse existing set_updated_at trigger function from 003_user_roles
CREATE TRIGGER notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Notification log (dedup + audit) ────────────────────────────────────────

CREATE TABLE notification_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_id  UUID NOT NULL REFERENCES favorites(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('time', 'distance', 'offroute')),
  trip_id      TEXT NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notification_log_dedup_idx
  ON notification_log(user_id, favorite_id, trigger_type, trip_id, sent_at DESC);

-- Service role needs full access for the scheduler (bypasses RLS)
-- No RLS on notification_log — only accessed by the API service role
