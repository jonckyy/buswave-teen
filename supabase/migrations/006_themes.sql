-- Theme system: multiple visual designs assignable per user role
-- Themes are stored as JSONB tokens (CSS variable overrides)

CREATE TABLE themes (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  tokens      JSONB NOT NULL,
  is_builtin  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed built-in themes
INSERT INTO themes (id, label, tokens, is_builtin) VALUES
('midnight', 'Midnight', '{
  "background": "10 14 23",
  "card": "19 26 43",
  "accent-cyan": "0 212 255",
  "muted": "136 146 176",
  "border": "30 42 63",
  "foreground": "226 232 240",
  "radius-sm": "0.375rem",
  "radius-md": "0.75rem",
  "radius-lg": "1rem",
  "glow-color": "0 212 255",
  "glow-intensity": "0px",
  "shimmer-duration": "0s",
  "font-family": "Inter, system-ui, sans-serif"
}', true),

('aurora', 'Aurora', '{
  "background": "2 6 23",
  "card": "14 18 35",
  "accent-cyan": "56 189 248",
  "muted": "148 163 184",
  "border": "30 41 59",
  "foreground": "241 245 249",
  "radius-sm": "0.5rem",
  "radius-md": "1rem",
  "radius-lg": "1.25rem",
  "glow-color": "56 189 248",
  "glow-intensity": "8px",
  "shimmer-duration": "8s",
  "font-family": "Inter, system-ui, sans-serif"
}', true),

('ember', 'Ember', '{
  "background": "20 12 12",
  "card": "35 22 22",
  "accent-cyan": "251 146 60",
  "muted": "163 143 120",
  "border": "68 44 30",
  "foreground": "254 243 199",
  "radius-sm": "0.25rem",
  "radius-md": "0.5rem",
  "radius-lg": "0.75rem",
  "glow-color": "251 146 60",
  "glow-intensity": "6px",
  "shimmer-duration": "0s",
  "font-family": "Inter, system-ui, sans-serif"
}', true),

('neon', 'Neon', '{
  "background": "15 15 35",
  "card": "30 28 53",
  "accent-cyan": "255 113 206",
  "muted": "148 163 184",
  "border": "76 29 149",
  "foreground": "237 237 239",
  "radius-sm": "0.375rem",
  "radius-md": "0.75rem",
  "radius-lg": "1rem",
  "glow-color": "255 113 206",
  "glow-intensity": "12px",
  "shimmer-duration": "12s",
  "font-family": "Inter, system-ui, sans-serif"
}', true);

-- Add theme_id column to role_config
ALTER TABLE role_config ADD COLUMN theme_id TEXT REFERENCES themes(id) DEFAULT 'midnight';

-- RLS for themes
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_reads_themes"
  ON themes FOR SELECT
  USING (true);

CREATE POLICY "admins_manage_themes"
  ON themes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Updated_at trigger
CREATE TRIGGER themes_updated_at
  BEFORE UPDATE ON themes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
