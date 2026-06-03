export const dynamic = 'force-dynamic'

import { type Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { query, queryOne } from '@/lib/db'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { ArrowLeft, MapPin, Video, Settings, BarChart2 } from 'lucide-react'
import { hasMinRole } from '@/lib/api-helpers'
import { getSignedVideoUrl } from '@/lib/s3'
import { ProjectNameEditor } from './ProjectNameEditor'
import { ProjectThumbnailUploader } from './ProjectThumbnailUploader'
import { ProjectViewShell } from './ProjectViewShell'
import type { DayTab, DaySession } from './ProjectDayView'

export const metadata: Metadata = { title: 'Project' }

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role, orgId, id: userId } = session.user

  // Fetch project — enforce access
  const project = await queryOne<{
    id: string; org_id: string; org_name: string; name: string
    address: string | null; status: string; created_at: string; thumbnail_url: string | null
    latitude: string | null; longitude: string | null
  }>(
    `SELECT p.id, p.org_id, o.name AS org_name, p.name, p.address, p.status, p.created_at,
            p.thumbnail_url, p.latitude, p.longitude
       FROM projects p
       JOIN organisations o ON o.id = p.org_id
      WHERE p.id = $1`,
    [projectId],
  )

  if (!project) notFound()

  // Access check
  const isSuperAdmin = role === 'super_admin'
  const isOrgAdmin = role === 'org_admin'
  const inSameOrg = project.org_id === orgId

  if (!isSuperAdmin) {
    if (!inSameOrg) notFound()
    if (!isOrgAdmin) {
      const membership = await queryOne(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, userId],
      )
      if (!membership) notFound()
    }
  }

  // Fetch distinct recording days for this project (for date tabs)
  const dayRows = await query<{ date: string; count: string }>(
    `SELECT DATE(recorded_at + interval '10 hours')::text AS date,
            COUNT(*)::text AS count
       FROM sessions
      WHERE project_id = $1
        AND status = 'READY'
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 30`,
    [projectId],
  )

  const days: DayTab[] = dayRows.map((r) => ({
    date: r.date,
    label: new Date(r.date + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short',
    }),
    count: parseInt(r.count, 10),
  }))

  // Fetch sessions + transcripts for the most recent day (initial load)
  const initialDate = days[0]?.date ?? ''
  let initialSessions: DaySession[] = []

  if (initialDate) {
    const sessionRows = await query<{
      id: string; title: string | null; recorded_at: string
      duration_secs: number | null; video_s3_key: string; status: string; media_type: string | null
      speaker_names: Record<string, string> | null; ai_tags: { trades: string[]; actions: string[]; topics: string[] } | null
    }>(
      `SELECT id, title, recorded_at, duration_secs, video_s3_key, status, media_type, speaker_names, ai_tags
         FROM sessions
        WHERE project_id = $1
          AND DATE(recorded_at + interval '10 hours') = $2::date
          AND status = 'READY'
        ORDER BY recorded_at ASC`,
      [projectId, initialDate],
    )

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
            ORDER BY session_id, segment_index ASC`,
          [sessionIds],
        )
      : []

    const segsBySession: Record<string, typeof segmentRows> = {}
    for (const seg of segmentRows) {
      if (!segsBySession[seg.session_id]) segsBySession[seg.session_id] = []
      segsBySession[seg.session_id].push(seg)
    }

    initialSessions = await Promise.all(
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
          segments: (segsBySession[s.id] ?? []).map((seg) => ({
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
  }

  const canEditProject = hasMinRole(role, 'site_admin')

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          href={isSuperAdmin ? `/organisations/${project.org_id}` : '/projects'}
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111827] mb-3"
        >
          <ArrowLeft size={14} />
          {isSuperAdmin ? project.org_name : 'My Projects'}
        </Link>
        <div className="flex items-start gap-6">
          {/* Thumbnail */}
          <div className="w-48 flex-shrink-0">
            <ProjectThumbnailUploader
              projectId={project.id}
              thumbnailUrl={project.thumbnail_url}
              canEdit={canEditProject}
            />
          </div>
          {/* Meta */}
          <div className="flex-1 flex items-start justify-between gap-4">
            <div>
              {isSuperAdmin ? (
                <ProjectNameEditor projectId={project.id} initialName={project.name} />
              ) : (
                <h1 className="text-2xl font-bold text-[#111827]">{project.name}</h1>
              )}
              {isSuperAdmin && (
                <p className="text-sm text-[#6B7280] mt-0.5">{project.org_name}</p>
              )}
              {project.address && (
                <div className="flex items-center gap-1.5 text-sm text-[#6B7280] mt-1">
                  <MapPin size={13} />
                  {project.address}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {project.status}
              </span>
              <Link
                href={`/projects/${project.id}/insights`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
                title="Project insights"
              >
                <BarChart2 size={14} />
                Insights
              </Link>
              {canEditProject && (
                <Link
                  href={`/projects/${project.id}/settings`}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
                  title="Project settings"
                >
                  <Settings size={15} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recordings — day view with playlist + transcripts */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
          <Video size={15} className="text-[#6B7280]" />
          <h2 className="text-sm font-semibold text-[#111827]">Recordings</h2>
        </div>
        <div className="px-6 py-4">
          {days.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#6B7280]">
              No recordings yet. Recordings will appear here once a mapped device uploads footage.
            </div>
          ) : (
            <ProjectViewShell
              projectId={project.id}
              projectName={project.name}
              days={days}
              initialDate={initialDate}
              initialSessions={initialSessions}
              address={project.address}
              latitude={project.latitude != null ? parseFloat(project.latitude) : null}
              longitude={project.longitude != null ? parseFloat(project.longitude) : null}
              canEdit={hasMinRole(role, 'editor')}
              isSuperAdmin={isSuperAdmin}
            />
          )}
        </div>
      </Card>

    </div>
  )
}
