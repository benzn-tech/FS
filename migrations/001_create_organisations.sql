-- Migration 001: Create organisations table
-- organisations must be created before users and sessions (FK dependencies)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- provides gen_random_uuid()

CREATE TABLE organisations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 VARCHAR(255) NOT NULL,
  aconex_config        JSONB,                           -- { api_key, project_id, ... }
  safebase_config      JSONB,                           -- { api_key, workspace_id, ... }
  transcribe_language  VARCHAR(10) DEFAULT 'en-AU',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Index for name lookups (admin search)
CREATE INDEX idx_organisations_name ON organisations (name);
