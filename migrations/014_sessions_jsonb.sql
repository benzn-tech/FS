-- Migration 014: Per-session speaker names and AI metadata tags
-- speaker_names: JSONB map { "spk_0": "John Smith", "spk_1": "Jane Doe" }
-- ai_tags:       JSONB { "trades": [], "actions": [], "topics": [] } — null until generated

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS speaker_names JSONB NOT NULL DEFAULT '{}';

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS ai_tags JSONB;
