-- Migration 005: Create export_log table
-- Depends on: 003_create_sessions

CREATE TABLE export_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES sessions(id),
  platform         VARCHAR(50) NOT NULL,           -- 'aconex' | 'safebase'
  status           VARCHAR(50) NOT NULL,           -- 'SUCCESS' | 'FAILED'
  exported_at      TIMESTAMPTZ DEFAULT NOW(),
  response_payload JSONB                           -- full API response for debugging
);

-- Index for fetching export history per session
CREATE INDEX idx_export_log_session_id ON export_log (session_id, exported_at DESC);
