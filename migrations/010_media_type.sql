-- Migration 010: Add media_type to sessions
-- Supports video, audio, and photo uploads from RealPTT devices

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS media_type VARCHAR(10) NOT NULL DEFAULT 'video'
    CHECK (media_type IN ('video', 'audio', 'photo'));

CREATE INDEX IF NOT EXISTS idx_sessions_media_type ON sessions(media_type);
