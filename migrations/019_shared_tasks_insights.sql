-- Migration 019: Shared project tasks + insights cache
--
-- 1. Make project_tasks project-shared (remove per-user scoping)
--    Tasks are now visible to all project members. created_by tracks who made it.
-- 2. Create project_insights cache table for keyword + recurring issues analysis.

-- Drop the old per-user index first
DROP INDEX IF EXISTS project_tasks_lookup;

-- Add created_by before dropping user_id (backfill from user_id)
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE project_tasks SET created_by = user_id WHERE created_by IS NULL;

-- Remove user_id column (tasks are now project-shared)
ALTER TABLE project_tasks DROP COLUMN IF EXISTS user_id;

-- New index: project + date only
CREATE INDEX IF NOT EXISTS project_tasks_project_date ON project_tasks (project_id, date);

-- Insights cache table
CREATE TABLE IF NOT EXISTS project_insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  keywords     JSONB NOT NULL DEFAULT '[]',
  issues       JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS project_insights_project ON project_insights (project_id);
