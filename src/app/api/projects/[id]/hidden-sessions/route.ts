import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { apiError } from '@/lib/api-helpers'

// GET /api/projects/[id]/hidden-sessions?date=YYYY-MM-DD
// Super-admin only. Returns SKIPPED, FAILED, INGESTED, TRANSCRIBING sessions for the date.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()
  if (session.user.role !== 'super_admin') return apiError.forbidden()

  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return apiError.badRequest('date param required (YYYY-MM-DD)')
  }

  const project = await queryOne<{ id: string }>(
    'SELECT id FROM projects WHERE id = $1',
    [projectId],
  )
  if (!project) return apiError.notFound('Project not found')

  const rows = await query<{
    id: string
    realptt_id: string | null
    title: string | null
    recorded_at: string
    duration_secs: number | null
    status: string
    error_message: string | null
    media_type: string | null
    realptt_account: string | null
  }>(
    `SELECT id, realptt_id, title, recorded_at, duration_secs, status,
            error_message, media_type, realptt_account
       FROM sessions
      WHERE project_id = $1
        AND DATE(recorded_at + interval '10 hours') = $2::date
        AND status IN ('SKIPPED', 'FAILED', 'INGESTED', 'TRANSCRIBING')
      ORDER BY recorded_at ASC`,
    [projectId, date],
  )

  return NextResponse.json({
    sessions: rows.map((r) => ({
      id: r.id,
      realpttId: r.realptt_id,
      title: r.title,
      recordedAt: r.recorded_at,
      durationSecs: r.duration_secs,
      status: r.status,
      errorMessage: r.error_message,
      mediaType: r.media_type,
      realpttAccount: r.realptt_account,
    })),
  })
}
