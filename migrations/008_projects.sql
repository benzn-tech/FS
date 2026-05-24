-- Migration 008: Projects, project devices, project members, project_id on sessions
-- Also makes sessions.user_id nullable (device recordings have no associated user)

-- ---------------------------------------------------------------------------
-- 1. Make sessions.user_id nullable
--    (recordings ingested from RealPTT devices have no FieldSightAI user)
-- ---------------------------------------------------------------------------
ALTER TABLE sessions
  ALTER COLUMN user_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. projects table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  address     TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);

-- ---------------------------------------------------------------------------
-- 3. project_devices — maps RealPTT src_account to a project
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_devices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  device_account VARCHAR(255) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_account)
);

CREATE INDEX IF NOT EXISTS idx_project_devices_project_id ON project_devices(project_id);

-- ---------------------------------------------------------------------------
-- 4. project_members — explicit per-project user access
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_members (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

-- ---------------------------------------------------------------------------
-- 5. Add project_id to sessions
-- ---------------------------------------------------------------------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);

-- ---------------------------------------------------------------------------
-- 6. Demo org and project seed (idempotent)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_demo_org_id  UUID;
  v_demo_proj_id UUID;
BEGIN
  INSERT INTO organisations (id, name)
  VALUES (gen_random_uuid(), 'Demo')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_demo_org_id FROM organisations WHERE name = 'Demo' LIMIT 1;

  INSERT INTO projects (id, org_id, name, address, status)
  VALUES (gen_random_uuid(), v_demo_org_id, 'Demo Project', NULL, 'active')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_demo_proj_id
    FROM projects
   WHERE org_id = v_demo_org_id AND name = 'Demo Project'
   LIMIT 1;

  RAISE NOTICE 'Demo org id: %', v_demo_org_id;
  RAISE NOTICE 'Demo project id: %', v_demo_proj_id;
END;
$$;
