-- Migration 010 rollback
ALTER TABLE sessions DROP COLUMN IF EXISTS media_type;
