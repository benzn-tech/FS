import { withAuth, apiError } from '@/lib/api-helpers'
import { queryOne, query } from '@/lib/db'
import { NextResponse } from 'next/server'

// PATCH /api/sessions/[id] — manually reassign project_id and/or user_id
// Requires site_admin or above. This is the only way to move a session after ingestion.
export const PATCH = withAuth(async (req, session, { params }) => {
  const id = (params as { id: string }).id
  const body = await req.json() as { projectId?: string | null; userId?: string | null }

  if (body.projectId === undefined && body.userId === undefined) {
    return apiError.badRequest('Provide at least one of: projectId, userId')
  }

  // Verify the session belongs to the user's org
  const existing = await queryOne<{ id: string; org_id: string }>(
    'SELECT id, org_id FROM sessions WHERE id = $1',
    [id],
  )
  if (!existing) return apiError.notFound('Session not found')

  const isInternal = session.user.role === 'org_admin' || session.user.role === 'super_admin'
  if (!isInternal && existing.org_id !== session.user.orgId) {
    return apiError.notFound('Session not found')
  }

  // Build update dynamically based on which fields were provided
  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = []

  if (body.projectId !== undefined) {
    values.push(body.projectId)
    setClauses.push(`project_id = $${values.length}`)
  }
  if (body.userId !== undefined) {
    values.push(body.userId)
    setClauses.push(`user_id = $${values.length}`)
  }

  values.push(id)
  await query(
    `UPDATE sessions SET ${setClauses.join(', ')} WHERE id = $${values.length}`,
    values,
  )

  return NextResponse.json({ success: true })
}, { minRole: 'site_admin' })

// GET /api/sessions/[id] — single session + metadata
export const GET = withAuth(async (req, session, { params }) => {
  const id = (params as { id: string }).id
  const isInternal = session.user.role === 'org_admin' || session.user.role === 'super_admin'

  const row = await queryOne<{
    id: string; org_id: string; user_id: string; title: string | null
    recorded_at: string; duration_secs: number | null; video_s3_key: string
    status: string; error_message: string | null; retry_count: number
    created_at: string; updated_at: string
  }>(
    isInternal
      ? 'SELECT * FROM sessions WHERE id = $1'
      : 'SELECT * FROM sessions WHERE id = $1 AND org_id = $2',
    isInternal ? [id] : [id, session.user.orgId],
  )

  if (!row) return apiError.notFound('Session not found')

  return NextResponse.json({
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    title: row.title ?? undefined,
    recordedAt: row.recorded_at,
    durationSeconds: row.duration_secs ?? undefined,
    s3VideoKey: row.video_s3_key,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
})
