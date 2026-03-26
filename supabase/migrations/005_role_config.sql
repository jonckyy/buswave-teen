-- Role-based configuration: per-role limits and feature visibility flags
-- Controlled by admin via the /admin dashboard

CREATE TABLE role_config (
  role TEXT PRIMARY KEY CHECK (role IN ('admin', 'editor', 'user')),

  -- Limits
  max_favorites           INT NOT NULL DEFAULT 50,
  max_push_favorites      INT NOT NULL DEFAULT 3,
  max_push_notifications  INT NOT NULL DEFAULT 50,

  -- Feature visibility
  show_debug_panel        BOOLEAN NOT NULL DEFAULT false,
  show_technical_data     BOOLEAN NOT NULL DEFAULT false,
  show_distance_metrics   BOOLEAN NOT NULL DEFAULT false,
  show_delay_badges       BOOLEAN NOT NULL DEFAULT true,
  show_live_page          BOOLEAN NOT NULL DEFAULT false,
  show_alerts_page        BOOLEAN NOT NULL DEFAULT true,
  arrivals_per_card       INT NOT NULL DEFAULT 3 CHECK (arrivals_per_card BETWEEN 1 AND 10),
  allowed_trigger_types   TEXT[] NOT NULL DEFAULT '{time}',

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default configuration for each role
INSERT INTO role_config (role, max_favorites, max_push_favorites, max_push_notifications,
  show_debug_panel, show_technical_data, show_distance_metrics, show_delay_badges,
  show_live_page, show_alerts_page, arrivals_per_card, allowed_trigger_types)
VALUES
  ('admin',  999, 20, 999, true,  true,  true,  true, true,  true, 10, '{time,distance,offroute}'),
  ('editor', 100, 20, 100, false, true,  true,  true, true,  true,  5, '{time,distance,offroute}'),
  ('user',    20,  3,  50, false, false, false, true, false, true,  3, '{time}');

-- RLS: anyone can read (feature flags are not secrets), only admins can update
ALTER TABLE role_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_role_config"
  ON role_config FOR SELECT
  USING (true);

CREATE POLICY "admins_update_role_config"
  ON role_config FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Reuse existing set_updated_at trigger function from 003_user_roles
CREATE TRIGGER role_config_updated_at
  BEFORE UPDATE ON role_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
