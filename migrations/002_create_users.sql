-- Migration 002: Create users table
-- Depends on: 001_create_organisations

-- Role enum for documentation purposes (enforced at application layer)
-- viewer | editor | editor_plus | site_admin | org_admin | super_admin
-- org_admin and super_admin are FieldSightAI-internal and not tied to a single org

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- org_id is nullable for org_admin/super_admin (platform-level roles, not org-scoped)
  org_id         UUID REFERENCES organisations(id),
  email          VARCHAR(255) UNIQUE NOT NULL,
  name           VARCHAR(255),
  role           VARCHAR(50) NOT NULL DEFAULT 'viewer',
                 -- viewer | editor | editor_plus | site_admin | org_admin | super_admin
  password_hash  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Index for auth lookups
CREATE INDEX idx_users_email ON users (email);
-- Index for listing users within an org
CREATE INDEX idx_users_org_id ON users (org_id);
