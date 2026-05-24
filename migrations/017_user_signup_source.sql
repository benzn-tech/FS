-- Migration 017: Add signup_source to users
-- Values: 'self' (registered via /register) | 'invited' (invited by admin)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signup_source VARCHAR(10) DEFAULT 'self';
