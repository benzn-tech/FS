-- Migration 015: Per-project GPS coordinates for map embed
-- When both are set, the map uses q=lat,lng instead of address string.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10, 7);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
