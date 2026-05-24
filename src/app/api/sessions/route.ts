import { withAuth } from '@/lib/api-helpers'
import { query } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/sessions — list sessions (paginated, filtered, role-scoped)
export const GET = withAuth(async (req, session) => {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '20')))
  const status = searchParams.get('status')
  const userId = searchParams.get('userId')
  const offset = (page - 1) * limit

  const { role, orgId, id: userId2 } = session.user
  const isSuperAdmin = role === 'super_admin'
  const isOrgAdmin = role === 'org_admin'

  const conditions: string[] = []
  const values: unknown[] = []
  let i = 1

  if (isSuperAdmin) {
    // no org filter — sees all
  } else if (isOrgAdmin) {
    conditions.push(`s.org_id = $${i++}`)
    values.push(orgId)
  } else {
    // Regular users: only sessions belonging to projects they are a member of
    conditions.push(`s.project_id IN (
      SELECT project_id FROM project_members WHERE user_id = $${i++}
    )`)
    values.push(userId2)
    conditions.push(`s.org_id = $${i++}`)
    values.push(orgId)
  }

  if (status) {
    conditions.push(`s.status = $${i++}`)
    values.push(status)
  }
  if (userId) {
    conditions.push(`s.user_id = $${i++}`)
    values.push(userId)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [rows, countRows] = await Promise.all([
    query<{
      id: string; org_id: string; user_id: string; project_id: string | null; title: string | null
      recorded_at: string; duration_secs: number | null; video_s3_key: string
      status: string; error_message: string | null; retry_count: number
      created_at: string; updated_at: string
    }>(
      `SELECT s.id, s.org_id, s.user_id, s.project_id, s.title, s.recorded_at, s.duration_secs,
              s.video_s3_key, s.status, s.error_message, s.retry_count,
              s.created_at, s.updated_at
       FROM sessions s ${where}
       ORDER BY s.recorded_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...values, limit, offset],
    ),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM sessions s ${where}`, values),
  ])

  const total = parseInt(countRows[0]?.count ?? '0', 10)

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      orgId: r.org_id,
      userId: r.user_id,
      projectId: r.project_id ?? undefined,
      title: r.title ?? undefined,
      recordedAt: r.recorded_at,
      durationSeconds: r.duration_secs ?? undefined,
      s3VideoKey: r.video_s3_key,
      status: r.status,
      errorMessage: r.error_message ?? undefined,
      retryCount: r.retry_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    pagination: { page, limit, total },
  })
})
