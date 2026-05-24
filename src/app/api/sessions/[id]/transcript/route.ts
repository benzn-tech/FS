import { withAuth, apiError, hasMinRole } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/sessions/[id]/transcript — list transcript segments
export const GET = withAuth(async (req, session, { params }) => {
  const id = (params as { id: string }).id

  // Confirm session belongs to org and caller is a member of the session's project (or site_admin+)
  const sessionRow = await queryOne<{ id: string; project_id: string }>(
    'SELECT id, project_id FROM sessions WHERE id = $1 AND org_id = $2',
    [id, session.user.orgId],
  )
  if (!sessionRow) return apiError.notFound('Session not found')

  if (!hasMinRole(session.user.role, 'site_admin')) {
    const member = await queryOne<{ user_id: string }>(
      'SELECT user_id FROM project_members WHERE project_id = $1 AND user_id = $2',
      [sessionRow.project_id, session.user.id],
    )
    if (!member) return apiError.notFound('Session not found')
  }

  const rows = await query<{
    id: string; session_id: string; segment_index: number
    start_time: string; end_time: string; speaker_label: string | null
    original_text: string; edited_text: string | null
    is_final: boolean; created_at: string
  }>(
    `SELECT id, session_id, segment_index, start_time, end_time,
            speaker_label, original_text, edited_text, is_final, created_at
     FROM transcript_segments
     WHERE session_id = $1
     ORDER BY segment_index ASC`,
    [id],
  )

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      segmentIndex: r.segment_index,
      startSecs: parseFloat(r.start_time),
      endSecs: parseFloat(r.end_time),
      speaker: r.speaker_label ?? undefined,
      originalText: r.original_text,
      editedText: r.edited_text ?? undefined,
      isFinal: r.is_final,
      createdAt: r.created_at,
    })),
  })
})

// PATCH /api/sessions/[id]/transcript — save edited segments
// Body: { segments: { id, editedText? }[] }
// original_text is NEVER modified — only edited_text is writable.
export const PATCH = withAuth(
  async (req, session, { params }) => {
    const id = (params as { id: string }).id
    const body = await req.json()
    const { segments } = body as { segments: { id: string; editedText?: string }[] }

    if (!Array.isArray(segments) || segments.length === 0) {
      return apiError.badRequest('segments must be a non-empty array')
    }

    // Confirm session belongs to org, caller is a project member (or site_admin+), and is not locked
    const sessionRow = await queryOne<{ id: string; project_id: string; status: string }>(
      'SELECT id, project_id, status FROM sessions WHERE id = $1 AND org_id = $2',
      [id, session.user.orgId],
    )
    if (!sessionRow) return apiError.notFound('Session not found')

    if (!hasMinRole(session.user.role, 'site_admin')) {
      const member = await queryOne<{ user_id: string }>(
        'SELECT user_id FROM project_members WHERE project_id = $1 AND user_id = $2',
        [sessionRow.project_id, session.user.id],
      )
      if (!member) return apiError.notFound('Session not found')
    }
    if (sessionRow.status === 'EXPORTED') {
      return apiError.badRequest('Cannot edit a transcript that has already been exported')
    }

    // Update each segment — only edited_text, never original_text
    await Promise.all(
      segments.map(({ id: segId, editedText }) => {
        if (editedText === undefined) return Promise.resolve()
        return query(
          `UPDATE transcript_segments
           SET edited_text = $1
           WHERE id = $2 AND session_id = $3`,
          [editedText, segId, id],
        )
      }),
    )

    return NextResponse.json({ ok: true })
  },
  { minRole: 'editor' },
)
