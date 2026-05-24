import { withAuth, apiError } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/admin/content?slug=landing — fetch all content for a page
export const GET = withAuth(
  async (req) => {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')
    if (!slug) return apiError.badRequest('slug is required')

    const rows = await query<{
      id: string; page_slug: string; key: string; value: string | null
      media_url: string | null; updated_at: string; updated_by: string | null
    }>(
      'SELECT id, page_slug, key, value, media_url, updated_at, updated_by FROM site_content WHERE page_slug = $1 ORDER BY key',
      [slug],
    )

    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        pageSlug: r.page_slug,
        key: r.key,
        value: r.value ?? undefined,
        mediaUrl: r.media_url ?? undefined,
        updatedAt: r.updated_at,
        updatedBy: r.updated_by ?? undefined,
      })),
    })
  },
  { exactRole: 'super_admin' },
)

// PATCH /api/admin/content — upsert a content field
export const PATCH = withAuth(
  async (req, session) => {
    const body = await req.json()
    const { pageSlug, key, value, mediaUrl } = body as {
      pageSlug: string
      key: string
      value?: string
      mediaUrl?: string
    }

    if (!pageSlug || !key) return apiError.badRequest('pageSlug and key are required')

    await query(
      `INSERT INTO site_content (page_slug, key, value, media_url, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (page_slug, key) DO UPDATE
         SET value      = EXCLUDED.value,
             media_url  = EXCLUDED.media_url,
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by`,
      [pageSlug, key, value ?? null, mediaUrl ?? null, session.user.id],
    )

    return NextResponse.json({ ok: true })
  },
  { exactRole: 'super_admin' },
)
