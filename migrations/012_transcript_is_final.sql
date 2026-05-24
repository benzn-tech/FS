-- Migration 012: Add is_final to transcript_segments
-- Tracks whether a segment has been finalized (locked from further edits)

ALTER TABLE transcript_segments
  ADD COLUMN IF NOT EXISTS is_final BOOLEAN NOT NULL DEFAULT false;
