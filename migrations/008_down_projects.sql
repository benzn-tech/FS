-- Migration 008 rollback: Remove projects, project_devices, project_members

ALTER TABLE sessions DROP COLUMN IF EXISTS project_id;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS project_devices;
DROP TABLE IF EXISTS projects;
ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL;
