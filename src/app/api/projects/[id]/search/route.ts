import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { apiError } from '@/lib/api-helpers'
import { verifyProjectAccess } from '@/lib/reports'

// GET /api/projects/[id]/search?q=query
// Full-text search across all transcript segments for a project.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()

  const { role, orgId, id: userId } = session.user

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return apiError.badRequest('Query must be at least 2 characters')

  const project = await verifyProjectAccess(projectId, role, orgId, userId)
  if (!project) return apiError.notFound('Project not found')

  const rows = await query<{
    segment_id: string
    session_id: string
    session_title: string | null
    recorded_at: string
    start_time: string
    text: string
    speaker_label: string | null
  }>(
    `SELECT ts.id AS segment_id,
            s.id AS session_id,
            s.title AS session_title,
            s.recorded_at,
            ts.start_time,
            COALESCE(ts.edited_text, ts.original_text) AS text,
            ts.speaker_label
       FROM transcript_segments ts
       JOIN sessions s ON s.id = ts.session_id
      WHERE s.project_id = $1
        AND (ts.original_text ILIKE $2 OR ts.edited_text ILIKE $2)
        AND (ts.is_deleted IS NOT TRUE)
      ORDER BY s.recorded_at DESC, ts.segment_index ASC
      LIMIT 50`,
    [projectId, `%${q}%`],
  )

  const results = rows.map((r) => ({
    segmentId: r.segment_id,
    sessionId: r.session_id,
    sessionTitle: r.session_title ?? undefined,
    recordedAt: r.recorded_at,
    startSecs: parseFloat(r.start_time),
    text: r.text,
    speakerLabel: r.speaker_label ?? undefined,
  }))

  return NextResponse.json({ results })
}
