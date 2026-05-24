-- Migration 009: Device routing enhancements
-- 1. Add user_id to project_devices (optional assigned user per device)
-- 2. Add realptt_account + realptt_user_name to sessions (raw RealPTT identity, immutable)

-- ---------------------------------------------------------------------------
-- 1. Add user_id to project_devices
--    Nullable — a device can be mapped to a project without a specific user
-- ---------------------------------------------------------------------------
ALTER TABLE project_devices
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2. Add raw RealPTT identity columns to sessions
--    Stored at ingest time, never overwritten — source of truth for "who recorded this"
-- ---------------------------------------------------------------------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS realptt_account    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS realptt_user_name  VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_sessions_realptt_account ON sessions(realptt_account);
