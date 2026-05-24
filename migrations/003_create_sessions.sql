-- Migration 003: Create sessions table
-- Depends on: 001_create_organisations, 002_create_users

CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  realptt_id      VARCHAR(255) UNIQUE,          -- RealPTT's video ID
  title           VARCHAR(255),                  -- auto-generated or user-set
  recorded_at     TIMESTAMPTZ NOT NULL,
  duration_secs   INTEGER,
  video_s3_key    TEXT NOT NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'INGESTED',
                  -- INGESTED | TRANSCRIBING | READY | FAILED | EXPORTED
  error_message   TEXT,                          -- last failure reason (set when status = FAILED)
  retry_count     INTEGER DEFAULT 0,             -- incremented on each user-initiated retry
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for listing sessions by org (main dashboard query)
CREATE INDEX idx_sessions_org_id ON sessions (org_id);
-- Index for listing sessions by user
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
-- Index for status filtering (FAILED sessions dashboard)
CREATE INDEX idx_sessions_status ON sessions (status);
-- Index for sorting by date
CREATE INDEX idx_sessions_recorded_at ON sessions (recorded_at DESC);

-- Trigger to auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
