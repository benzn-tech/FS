-- Migration 013: Org-level device ownership
-- Adds org_devices table to record which device accounts belong to which organisation.
-- Also adds an optional human-readable label (nickname) per device.
--
-- Relationship:
--   organisations  1──* org_devices  (org owns N devices)
--   org_devices    1──? project_devices  (device optionally mapped to a project within that org)
--
-- One-time backfill: infer org ownership from existing project_devices rows.

CREATE TABLE IF NOT EXISTS org_devices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  device_account VARCHAR(255) NOT NULL,
  label          VARCHAR(255),                         -- optional human-readable nickname
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_account)                              -- a device belongs to exactly one org at a time
);

CREATE INDEX IF NOT EXISTS idx_org_devices_org_id ON org_devices(org_id);

-- ---------------------------------------------------------------------------
-- One-time backfill: populate org_devices from existing project_devices rows
-- (infer org_id via the project the device is currently mapped to)
-- ---------------------------------------------------------------------------
INSERT INTO org_devices (org_id, device_account)
SELECT DISTINCT p.org_id, pd.device_account
  FROM project_devices pd
  JOIN projects p ON p.id = pd.project_id
ON CONFLICT (device_account) DO NOTHING;
