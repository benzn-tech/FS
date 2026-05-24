export const dynamic = 'force-dynamic'

import { type Metadata } from 'next'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { hasMinRole } from '@/lib/api-helpers'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RotateCcw, ChevronRight, AlertTriangle, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { type Session } from '@/types'

export const metadata: Metadata = { title: 'Recordings' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatDuration(secs?: number) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter } = await searchParams
  const showUnassigned = filter === 'unassigned'

  const session = await auth()
  const orgId = session?.user.orgId
  const role = session?.user.role ?? 'viewer'
  const canManage = hasMinRole(role, 'site_admin')

  const rows = await query<{
    id: string; title: string | null; recorded_at: string; duration_secs: number | null
    status: string; error_message: string | null; retry_count: number
    project_id: string | null; project_name: string | null; realptt_account: string | null
    media_type: string | null
  }>(
    showUnassigned
      ? `SELECT s.id, s.title, s.recorded_at, s.duration_secs, s.status, s.error_message,
                s.retry_count, s.project_id, p.name AS project_name, s.realptt_account, s.media_type
           FROM sessions s
           LEFT JOIN projects p ON p.id = s.project_id
          WHERE s.org_id = $1
            AND s.project_id IS NULL
            AND s.status != 'SKIPPED'
          ORDER BY s.recorded_at DESC
          LIMIT 100`
      : `SELECT s.id, s.title, s.recorded_at, s.duration_secs, s.status, s.error_message,
                s.retry_count, s.project_id, p.name AS project_name, s.realptt_account, s.media_type
           FROM sessions s
           LEFT JOIN projects p ON p.id = s.project_id
          WHERE s.org_id = $1
            AND s.status != 'SKIPPED'
          ORDER BY s.recorded_at DESC
          LIMIT 100`,
    [orgId],
  )

  const unassignedCount = showUnassigned
    ? rows.length
    : rows.filter((r) => !r.project_id).length

  const sessions: (Session & { projectId?: string; projectName?: string; realpttAccount?: string; mediaType?: string })[] = rows.map((r) => ({
    id: r.id,
    orgId: orgId!,
    userId: '',
    title: r.title ?? undefined,
    recordedAt: r.recorded_at,
    durationSeconds: r.duration_secs ?? undefined,
    status: r.status as Session['status'],
    errorMessage: r.error_message ?? undefined,
    retryCount: r.retry_count,
    createdAt: r.recorded_at,
    updatedAt: r.recorded_at,
    projectId: r.project_id ?? undefined,
    projectName: r.project_name ?? undefined,
    realpttAccount: r.realptt_account ?? undefined,
    mediaType: r.media_type ?? undefined,
  }))

  const MEDIA_LABEL: Record<string, string> = {
    video: 'Video', audio: 'Audio', photo: 'Photo',
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Recordings</h1>
          <p className="text-sm text-[#6B7280] mt-1">All site recordings</p>
        </div>
        {canManage && unassignedCount > 0 && !showUnassigned && (
          <Link
            href="/sessions?filter=unassigned"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <AlertTriangle size={14} />
            {unassignedCount} unassigned
          </Link>
        )}
      </div>

      {/* Filter tabs (site_admin+) */}
      {canManage && (
        <div className="flex gap-1 border-b border-[#E5E7EB]">
          <Link
            href="/sessions"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              !showUnassigned
                ? 'border-[#FFD966] text-[#111827]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            All recordings
          </Link>
          <Link
            href="/sessions?filter=unassigned"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              showUnassigned
                ? 'border-[#FFD966] text-[#111827]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            Unassigned
            {unassignedCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">
                {unassignedCount}
              </span>
            )}
          </Link>
        </div>
      )}

      <Card padding="none">
        <div className="px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#111827]">
            {sessions.length} recording{sessions.length !== 1 ? 's' : ''}
            {showUnassigned && ' · unassigned'}
          </h2>
        </div>

        {sessions.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[#6B7280]">
            {showUnassigned
              ? 'No unassigned recordings — all sessions are assigned to projects.'
              : 'No sessions yet — recordings will appear here once the pipeline ingests your first video.'}
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E7EB]">
            {sessions.map((s) => (
              <li key={s.id} className="group">
                <div className="flex items-center gap-4 px-6 py-4 hover:bg-[#F9FAFB] transition-colors">
                  <Link
                    href={`/sessions/${s.id}`}
                    className="flex-1 flex items-center gap-4 min-w-0"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <p className="text-sm font-medium text-[#111827] group-hover:text-[#FF8F00] transition-colors truncate">
                        {s.title ?? `Session ${s.id}`}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-xs text-[#6B7280]">{formatDate(s.recordedAt)}</p>
                        {s.durationSeconds && (
                          <p className="text-xs text-[#6B7280]">{formatDuration(s.durationSeconds)}</p>
                        )}
                        {s.mediaType && s.mediaType !== 'video' && (
                          <span className="text-xs text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
                            {MEDIA_LABEL[s.mediaType] ?? s.mediaType}
                          </span>
                        )}
                        {canManage && (
                          s.projectName ? (
                            <span className="text-xs text-[#6B7280] flex items-center gap-1">
                              <FolderOpen size={11} />
                              {s.projectName}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium">Unassigned</span>
                          )
                        )}
                        {canManage && s.realpttAccount && (
                          <span className="text-xs font-mono text-[#9CA3AF]">{s.realpttAccount}</span>
                        )}
                        {s.status === 'FAILED' && s.errorMessage && (
                          <p className="text-xs text-[#EF4444] flex items-center gap-1">
                            <AlertTriangle size={11} />
                            {s.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={s.status} />
                      <ChevronRight size={16} className="text-[#E5E7EB] group-hover:text-[#6B7280] transition-colors" />
                    </div>
                  </Link>

                  {s.status === 'FAILED' && (
                    <form action={`/api/sessions/${s.id}/retry`} method="POST">
                      <Button type="submit" variant="outline" size="sm" className="flex-shrink-0 gap-1.5">
                        <RotateCcw size={13} />
                        Retry
                        {s.retryCount > 0 && <span className="text-xs opacity-60">({s.retryCount})</span>}
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
