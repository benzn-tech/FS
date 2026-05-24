import { withAuth, apiError } from '@/lib/api-helpers'
import { queryOne, query } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/sessions/[id]/export-history — export log entries for session
export const GET = withAuth(async (req, session, { params }) => {
  const id = (params as { id: string }).id

  const sessionRow = await queryOne<{ id: string }>(
    'SELECT id FROM sessions WHERE id = $1 AND org_id = $2',
    [id, session.user.orgId],
  )
  if (!sessionRow) return apiError.notFound('Session not found')

  const rows = await query<{
    id: string; session_id: string; platform: string; status: string
    exported_at: string; response_payload: Record<string, unknown> | null
  }>(
    `SELECT id, session_id, platform, status, exported_at, response_payload
     FROM export_log
     WHERE session_id = $1
     ORDER BY exported_at DESC`,
    [id],
  )

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      platform: r.platform,
      status: r.status,
      exportedAt: r.exported_at,
      responsePayload: r.response_payload ?? undefined,
    })),
  })
})
