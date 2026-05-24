export const dynamic = 'force-dynamic'

import { type Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasMinRole } from '@/lib/api-helpers'
import { queryOne, query } from '@/lib/db'
import { getSignedVideoUrl } from '@/lib/s3'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { FailedSessionBanner } from '@/components/sessions/FailedSessionBanner'
import { VideoPlayer } from '@/components/sessions/VideoPlayer'
import { TranscriptPanel } from '@/components/sessions/TranscriptPanel'
import { ExportPanel } from '@/components/sessions/ExportPanel'
import { AssignmentPanel } from '@/components/sessions/AssignmentPanel'
import { type TranscriptSegment, type ExportLog } from '@/types'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Recording Detail' }

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userRole = session?.user.role ?? 'viewer'
  const orgId = session?.user.orgId

  const canEdit = hasMinRole(userRole, 'editor')
  const canExport = hasMinRole(userRole, 'editor')
  const canAssign = hasMinRole(userRole, 'site_admin')

  // Load session — scoped to org
  const record = await queryOne<{
    id: string; org_id: string; user_id: string | null; project_id: string | null
    title: string | null; recorded_at: string; duration_secs: number | null
    video_s3_key: string; status: string; error_message: string | null
    retry_count: number; realptt_account: string | null; media_type: string | null
  }>(
    `SELECT s.*, s.project_id, s.user_id, s.realptt_account, s.media_type
       FROM sessions s
      WHERE s.id = $1 AND s.org_id = $2`,
    [id, orgId],
  )
  if (!record) notFound()

  // For assignment panel — load org projects and users (site_admin+)
  const [orgProjects, orgUsers] = canAssign
    ? await Promise.all([
        query<{ id: string; name: string }>(
          'SELECT id, name FROM projects WHERE org_id = $1 AND status = $2 ORDER BY name ASC',
          [orgId, 'active'],
        ),
        query<{ id: string; name: string | null; email: string }>(
          'SELECT id, name, email FROM users WHERE org_id = $1 ORDER BY name ASC',
          [orgId],
        ),
      ])
    : [[], []]

  // Load transcript segments
  const segmentRows = await query<{
    id: string; session_id: string; segment_index: number
    start_time: string; end_time: string; speaker_label: string | null
    original_text: string; edited_text: string | null; is_final: boolean; created_at: string
  }>(
    `SELECT id, session_id, segment_index, start_time, end_time,
            speaker_label, original_text, edited_text, is_final, created_at
     FROM transcript_segments
     WHERE session_id = $1
     ORDER BY segment_index ASC`,
    [id],
  )

  const segments: TranscriptSegment[] = segmentRows.map((r) => ({
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
  }))

  // Load export history
  const exportRows = await query<{
    id: string; session_id: string; platform: string; status: string; exported_at: string
  }>(
    'SELECT id, session_id, platform, status, exported_at FROM export_log WHERE session_id = $1 ORDER BY exported_at DESC',
    [id],
  )

  const exportHistory: ExportLog[] = exportRows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    platform: r.platform as ExportLog['platform'],
    status: r.status as ExportLog['status'],
    exportedBy: '',
    exportedAt: r.exported_at,
  }))

  // Pre-signed video URL (best-effort — video may not exist yet)
  let signedVideoUrl: string | undefined
  if (record.video_s3_key) {
    try {
      signedVideoUrl = await getSignedVideoUrl(record.video_s3_key)
    } catch {
      // S3 not reachable at build/dev time — fine, player shows placeholder
    }
  }

  const isFinalized = record.status === 'READY' || record.status === 'EXPORTED'

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      {/* Back + title row */}
      <div className="flex items-center gap-3">
        <Link
          href="/sessions"
          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB] transition-colors"
        >
          <ChevronLeft size={18} />
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-bold text-[#111827] truncate">
            {record.title ?? `Session ${record.id}`}
          </h1>
          <StatusBadge status={record.status as import('@/types').SessionStatus} />
        </div>
      </div>

      {/* Failed banner */}
      {record.status === 'FAILED' && (
        <FailedSessionBanner
          sessionId={record.id}
          errorMessage={record.error_message ?? undefined}
          retryCount={record.retry_count}
        />
      )}

      {/* Main two-col layout */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        {/* Left — video + transcript */}
        <div className="flex flex-col gap-4">
          <Card padding="sm">
            <VideoPlayer signedUrl={signedVideoUrl} />
          </Card>

          <Card className="flex flex-col gap-2 flex-1" style={{ minHeight: '360px' }}>
            <h2 className="text-sm font-semibold text-[#111827] px-1">Transcript</h2>
            <TranscriptPanel
              segments={segments}
              sessionId={record.id}
              canEdit={canEdit}
            />
          </Card>
        </div>

        {/* Right — export panel + meta */}
        <div className="flex flex-col gap-4">
          <Card>
            <ExportPanel
              sessionId={record.id}
              exportHistory={exportHistory}
              canExport={canExport}
              isFinalized={isFinalized}
            />
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-[#111827]">Details</h2>
            <dl className="flex flex-col gap-2 text-xs">
              {[
                {
                  label: 'Recorded',
                  value: new Date(record.recorded_at).toLocaleDateString('en-AU', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  }),
                },
                {
                  label: 'Duration',
                  value: record.duration_secs ? `${Math.floor(record.duration_secs / 60)} min` : '—',
                },
                {
                  label: 'Media type',
                  value: record.media_type ? record.media_type.charAt(0).toUpperCase() + record.media_type.slice(1) : '—',
                },
                ...(record.realptt_account ? [{ label: 'Device', value: record.realptt_account, mono: true }] : []),
                { label: 'Retry count', value: String(record.retry_count) },
                { label: 'Recording ID', value: record.id, mono: true },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-[#6B7280]">{label}</dt>
                  <dd className={mono ? 'font-mono text-[10px] text-[#111827]' : 'text-[#111827] text-right'}>{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {canAssign && (
            <Card className="flex flex-col gap-3">
              <AssignmentPanel
                sessionId={record.id}
                currentProjectId={record.project_id}
                currentUserId={record.user_id}
                projects={orgProjects}
                users={orgUsers}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
