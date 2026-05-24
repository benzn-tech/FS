import { withAuth, apiError } from '@/lib/api-helpers'
import { queryOne, query } from '@/lib/db'
import { NextResponse } from 'next/server'

// PATCH /api/sessions/[id]/speakers
// Body: { spk_0: "John Smith", spk_1: "Jane Doe", ... }
// Saves per-session speaker name mappings.
export const PATCH = withAuth(
  async (req, session, { params }) => {
    const id = (params as { id: string }).id
    const orgId = session.user.orgId
    const isInternal = session.user.role === 'org_admin' || session.user.role === 'super_admin'

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return apiError.badRequest('Body must be an object mapping speaker labels to names')
    }

    const entries = Object.entries(body as Record<string, unknown>)
    if (entries.length > 20) return apiError.badRequest('Too many speakers (max 20)')
    for (const [k, v] of entries) {
      if (typeof v !== 'string') return apiError.badRequest(`Value for "${k}" must be a string`)
      if (v.length > 100) return apiError.badRequest(`Name for "${k}" is too long (max 100 chars)`)
    }

    const existing = await queryOne<{ id: string; org_id: string }>(
      isInternal
        ? 'SELECT id, org_id FROM sessions WHERE id = $1'
        : 'SELECT id, org_id FROM sessions WHERE id = $1 AND org_id = $2',
      isInternal ? [id] : [id, orgId],
    )
    if (!existing) return apiError.notFound('Session not found')

    await query(
      'UPDATE sessions SET speaker_names = $1::jsonb, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(body), id],
    )

    return NextResponse.json({ ok: true })
  },
  { minRole: 'editor' },
)
