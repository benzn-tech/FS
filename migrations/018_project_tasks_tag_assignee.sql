-- Migration 018: Add tag and assignee to project_tasks
-- tag: trade/topic metadata tag (e.g. Steel, Concrete, Safety)
-- assignee_id: optional project member assigned to this task

ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS tag         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id) ON DELETE SET NULL;
