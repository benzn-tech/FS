import { withAuth, apiError } from '@/lib/api-helpers'
import { queryOne, query } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/sessions/[id]/transcript/finalize — lock transcript, set status READY
export const POST = withAuth(
  async (req, session, { params }) => {
    const id = (params as { id: string }).id

    const row = await queryOne<{ id: string; status: string }>(
      'SELECT id, status FROM sessions WHERE id = $1 AND org_id = $2',
      [id, session.user.orgId],
    )
    if (!row) return apiError.notFound('Session not found')
    if (row.status === 'EXPORTED') return apiError.badRequest('Session already exported')
    if (row.status === 'INGESTED' || row.status === 'TRANSCRIBING') {
      return apiError.badRequest('Transcript is not ready yet')
    }

    await query(
      `UPDATE sessions SET status = 'READY', updated_at = NOW() WHERE id = $1`,
      [id],
    )
    await query(
      `UPDATE transcript_segments SET is_final = true WHERE session_id = $1`,
      [id],
    )

    return NextResponse.json({ ok: true })
  },
  { minRole: 'editor' },
)
