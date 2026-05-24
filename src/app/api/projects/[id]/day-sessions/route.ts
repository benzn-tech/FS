import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { apiError } from '@/lib/api-helpers'
import { getSignedVideoUrl } from '@/lib/s3'

// GET /api/projects/[id]/day-sessions?date=YYYY-MM-DD
// Returns sessions for the given project on the given date, with transcripts and signed URLs.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()

  const { role, orgId, id: userId } = session.user
  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return apiError.badRequest('date param required (YYYY-MM-DD)')
  }

  // Verify project access
  const project = await queryOne<{ id: string; org_id: string }>(
    'SELECT id, org_id FROM projects WHERE id = $1',
    [projectId],
  )
  if (!project) return apiError.notFound('Project not found')

  if (role !== 'super_admin') {
    if (project.org_id !== orgId) return apiError.notFound('Project not found')
    if (role !== 'org_admin') {
      const membership = await queryOne(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, userId],
      )
      if (!membership) return apiError.notFound('Project not found')
    }
  }

  // Sessions for this project on this date (local date comparison via recorded_at)
  const sessionRows = await query<{
    id: string; title: string | null; recorded_at: string
    duration_secs: number | null; video_s3_key: string; status: string; media_type: string | null
    speaker_names: Record<string, string> | null; ai_tags: { trades: string[]; actions: string[]; topics: string[] } | null
  }>(
    `SELECT id, title, recorded_at, duration_secs, video_s3_key, status, media_type, speaker_names, ai_tags
       FROM sessions
      WHERE project_id = $1
        AND DATE(recorded_at AT TIME ZONE 'UTC') = $2::date
        AND status != 'SKIPPED'
      ORDER BY recorded_at ASC`,
    [projectId, date],
  )

  // Load all transcript segments for these sessions in one query
  const sessionIds = sessionRows.map((s) => s.id)
  const segmentRows = sessionIds.length > 0
    ? await query<{
        id: string; session_id: string; segment_index: number
        start_time: string; end_time: string; speaker_label: string | null
        original_text: string; edited_text: string | null; is_final: boolean
      }>(
        `SELECT id, session_id, segment_index, start_time, end_time,
                speaker_label, original_text, edited_text, is_final
           FROM transcript_segments
          WHERE session_id = ANY($1)
            AND (edited_text IS NULL OR edited_text != '' OR is_final = false)
          ORDER BY session_id, segment_index ASC`,
        [sessionIds],
      )
    : []

  // Group segments by session
  const segmentsBySession: Record<string, typeof segmentRows> = {}
  for (const seg of segmentRows) {
    if (!segmentsBySession[seg.session_id]) segmentsBySession[seg.session_id] = []
    segmentsBySession[seg.session_id].push(seg)
  }

  // Generate signed URLs (best effort)
  const sessions = await Promise.all(
    sessionRows.map(async (s) => {
      let signedUrl: string | undefined
      if (s.video_s3_key) {
        try { signedUrl = await getSignedVideoUrl(s.video_s3_key) } catch { /* ignore */ }
      }
      return {
        id: s.id,
        title: s.title,
        recordedAt: s.recorded_at,
        durationSecs: s.duration_secs,
        status: s.status,
        mediaType: s.media_type,
        speakerNames: s.speaker_names ?? {},
        aiTags: s.ai_tags ?? undefined,
        signedUrl,
        segments: (segmentsBySession[s.id] ?? []).map((seg) => ({
          id: seg.id,
          segmentIndex: seg.segment_index,
          startSecs: parseFloat(seg.start_time),
          endSecs: parseFloat(seg.end_time),
          speaker: seg.speaker_label ?? undefined,
          text: seg.edited_text || seg.original_text,
          isFinal: seg.is_final,
        })),
      }
    }),
  )

  return NextResponse.json({ sessions })
}
