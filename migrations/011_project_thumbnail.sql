-- Migration 011: Add thumbnail_url to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
