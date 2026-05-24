import { siteConfig } from '@/config/site'
import { query } from '@/lib/db'

/**
 * Hardcoded defaults — rendered when the DB has no CMS override for a key.
 */
const CONTENT_DEFAULTS: Record<string, Record<string, string>> = {
  landing: {
    'hero.headline': 'Your site, documented automatically.',
    'hero.subheadline': siteConfig.description,
    'hero.cta_primary': 'Get Started Free',
    'hero.cta_secondary': 'How It Works',
    'features.title': 'Everything you need, nothing you don\'t',
    'features.subtitle': 'FieldSightAI handles the entire documentation pipeline from capture to compliance.',
    'features.0.title': 'Auto Transcription',
    'features.0.description': 'Body camera footage is automatically transcribed via Amazon Transcribe the moment it hits the cloud.',
    'features.1.title': 'Video Sync',
    'features.1.description': 'Every transcript segment is time-linked to the exact moment in your video.',
    'features.2.title': 'One-Click Export',
    'features.2.description': 'Reviewed transcripts are pushed directly into Aconex or Safebase as daily diary entries.',
    'cta.headline': 'Ready to eliminate daily diary writing?',
    'cta.body': 'Join construction teams using FieldSightAI to turn body camera footage into compliance-ready records.',
    'cta.button': 'Get Started Free',
  },
  global: {
    'nav.logo': 'FieldSightAI',
    'footer.tagline': siteConfig.tagline,
  },
}

export interface ContentItem {
  key: string
  value: string
  mediaUrl?: string
  updatedAt?: string
}

/**
 * Retrieve all content for a given page slug.
 * DB overrides are merged on top of hardcoded defaults — the site works
 * correctly with zero DB content, and CMS edits layer on top.
 */
export async function getContent(slug: string): Promise<Record<string, ContentItem>> {
  const defaults = CONTENT_DEFAULTS[slug] ?? {}

  let dbRows: { key: string; value: string | null; media_url: string | null; updated_at: string }[] = []
  try {
    dbRows = await query<{ key: string; value: string | null; media_url: string | null; updated_at: string }>(
      'SELECT key, value, media_url, updated_at FROM site_content WHERE page_slug = $1',
      [slug],
    )
  } catch {
    // DB not available (e.g. build time) — fall back to defaults silently
  }

  // Start with defaults, overlay any DB values
  const result: Record<string, ContentItem> = Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [key, { key, value }]),
  )
  for (const row of dbRows) {
    result[row.key] = {
      key: row.key,
      value: row.value ?? defaults[row.key] ?? '',
      mediaUrl: row.media_url ?? undefined,
      updatedAt: row.updated_at,
    }
  }

  return result
}

/**
 * Retrieve a single content value, falling back to the default.
 */
export async function getContentValue(slug: string, key: string): Promise<string> {
  const all = await getContent(slug)
  return all[key]?.value ?? CONTENT_DEFAULTS[slug]?.[key] ?? ''
}

/**
 * List all editable sections for the CMS overview.
 */
export const EDITABLE_PAGES = [
  { slug: 'landing', label: 'Landing Page', description: 'Hero, features, CTA banner' },
  { slug: 'global', label: 'Global', description: 'Nav logo, footer tagline' },
] as const
