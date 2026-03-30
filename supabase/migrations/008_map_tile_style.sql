-- ─── Add map tile style to role config ────────────────────────────────────────
ALTER TABLE role_config
  ADD COLUMN IF NOT EXISTS map_tile_style TEXT NOT NULL DEFAULT 'osm-standard';
