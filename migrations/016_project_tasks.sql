-- Migration 016: Per-user editable task list per project/date
-- Tasks can be AI-generated (seeded from /api/projects/[id]/tasks) or manually created.
-- Scoped per user so each person has their own checklist.

CREATE TABLE IF NOT EXISTS project_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  text        TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_tasks_lookup ON project_tasks (project_id, user_id, date);
