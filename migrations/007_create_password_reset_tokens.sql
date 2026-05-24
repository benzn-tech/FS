-- Migration 007: Create password_reset_tokens table
-- Depends on: 002_create_users

CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,   -- SHA-256 hash of the raw token (never store raw)
  expires_at  TIMESTAMPTZ NOT NULL,   -- 15 minutes from creation
  used_at     TIMESTAMPTZ,            -- set when the token is consumed; NULL = unused
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by token hash during reset
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens (token_hash);
-- Index to allow cleanup of expired/used tokens
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);
