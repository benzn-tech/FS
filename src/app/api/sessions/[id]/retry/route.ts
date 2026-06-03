import { withAuth, apiError } from '@/lib/api-helpers'
import { queryOne, query } from '@/lib/db'
import { publishEvent } from '@/lib/eventbridge'
import { NextResponse } from 'next/server'

const MAX_RETRIES = 3

// POST /api/sessions/[id]/retry — re-trigger pipeline for FAILED sessions
export const POST = withAuth(
  async (req, session, { params }) => {
    const id = (params as { id: string }).id

    const row = await queryOne<{ id: string; status: string; retry_count: number; realptt_id: string | null }>(
      'SELECT id, status, retry_count, realptt_id FROM sessions WHERE id = $1 AND org_id = $2',
      [id, session.user.orgId],
    )
    if (!row) return apiError.notFound('Session not found')
    if (row.status !== 'FAILED') return apiError.badRequest('Only FAILED sessions can be retried')
    if (row.retry_count >= MAX_RETRIES) {
      return apiError.badRequest(`Maximum retry limit (${MAX_RETRIES}) reached`)
    }

    await query(
      `UPDATE sessions
       SET status = 'INGESTED', retry_count = retry_count + 1, error_message = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id],
    )

    await publishEvent('retry-requested', {
      realptt_id: row.realptt_id,
    })

    return NextResponse.json({ ok: true, message: 'Pipeline re-triggered' })
  },
  { minRole: 'editor' },
)
