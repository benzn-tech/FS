-- Rollback 012: Remove is_final from transcript_segments

ALTER TABLE transcript_segments
  DROP COLUMN IF EXISTS is_final;
