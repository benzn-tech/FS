-- Migration 006: Create site_content table (CMS)
-- Depends on: 002_create_users
-- Stores editable marketing page content managed via the /admin CMS.
-- Falls back to hardcoded siteConfig defaults if no row exists for a key.

CREATE TABLE site_content (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug   VARCHAR(100) NOT NULL,   -- 'landing', 'global', etc.
  key         VARCHAR(200) NOT NULL,   -- 'hero.headline', 'features.0.title', etc.
  value       TEXT,                    -- text content
  media_url   TEXT,                    -- S3 public URL for images
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id),

  UNIQUE (page_slug, key)
);

-- Index for fetching all content for a page slug (used by getContent(slug))
CREATE INDEX idx_site_content_page_slug ON site_content (page_slug);
