import { withAuth, apiError } from '@/lib/api-helpers'
import { queryOne, query } from '@/lib/db'
import { sendTranscriptEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

// POST /api/sessions/[id]/email — email the transcript to the requesting user
export const POST = withAuth(
  async (req, session, { params }) => {
    const id = (params as { id: string }).id
    const userEmail = session.user.email
    const orgId = session.user.orgId
    const isInternal = session.user.role === 'org_admin' || session.user.role === 'super_admin'

    if (!userEmail) return apiError.badRequest('No email address on account')

    const body = await req.json().catch(() => ({}))
    const { recipientEmail } = body as { recipientEmail?: string }
    const to = recipientEmail?.trim() || userEmail

    const sessionRow = await queryOne<{ id: string; org_id: string; title: string | null }>(
      isInternal
        ? 'SELECT id, org_id, title FROM sessions WHERE id = $1'
        : 'SELECT id, org_id, title FROM sessions WHERE id = $1 AND org_id = $2',
      isInternal ? [id] : [id, orgId],
    )
    if (!sessionRow) return apiError.notFound('Session not found')

    const segments = await query<{
      start_time: string
      speaker_label: string | null
      text: string
    }>(
      `SELECT start_time, speaker_label, COALESCE(edited_text, original_text) AS text
         FROM transcript_segments
        WHERE session_id = $1
          AND (is_deleted IS NOT TRUE)
        ORDER BY segment_index ASC`,
      [id],
    )

    const title = sessionRow.title ?? `Session ${id}`
    await sendTranscriptEmail(to, title, segments)

    return NextResponse.json({ ok: true, sentTo: to })
  },
  { minRole: 'editor' },
)
