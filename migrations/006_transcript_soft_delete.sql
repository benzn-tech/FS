-- Migration 006: Add soft-delete to transcript_segments
-- Allows users to "delete" segments without destroying the immutable original_text.
-- is_deleted = true means the segment is hidden from exports/display but recoverable.

ALTER TABLE transcript_segments
  ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- Index to efficiently fetch only non-deleted segments
CREATE INDEX idx_transcript_segments_active
  ON transcript_segments (session_id, segment_index)
  WHERE is_deleted = FALSE;
