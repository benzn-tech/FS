-- Migration 004: Create transcript_segments table
-- Depends on: 003_create_sessions

CREATE TABLE transcript_segments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  segment_index   INTEGER NOT NULL,              -- ordering within session (0-based)
  start_time      NUMERIC(10, 3),               -- seconds from video start
  end_time        NUMERIC(10, 3),
  speaker_label   VARCHAR(50),                   -- SPEAKER_0, SPEAKER_1, etc. (diarization)
  original_text   TEXT NOT NULL,                 -- immutable Amazon Transcribe output
  edited_text     TEXT,                          -- user-edited version (NULL until first edit)
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Enforce unique ordering per session
  UNIQUE (session_id, segment_index)
);

-- Index for fetching all segments for a session in order
CREATE INDEX idx_transcript_segments_session_id ON transcript_segments (session_id, segment_index);
