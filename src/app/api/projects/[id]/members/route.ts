import { withAuth, apiError, hasMinRole } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/projects/[id]/members
export const GET = withAuth(
  async (_req, session, ctx) => {
    const projectId = ctx.params?.id as string

    const project = await queryOne<{ id: string; org_id: string }>('SELECT id, org_id FROM projects WHERE id = $1', [projectId])
    if (!project) return apiError.notFound('Project not found')

    // site_admin can only view members of projects within their own org
    if (!hasMinRole(session.user.role, 'super_admin') && project.org_id !== session.user.orgId) {
      return apiError.notFound('Project not found')
    }

    const rows = await query<{ user_id: string; email: string; name: string | null; role: string; added_at: string }>(
      `SELECT pm.user_id, u.email, u.name, u.role, pm.added_at
         FROM project_members pm
         JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = $1
        ORDER BY pm.added_at ASC`,
      [projectId],
    )

    return NextResponse.json({
      data: rows.map((r) => ({
        userId: r.user_id,
        email: r.email,
        name: r.name ?? undefined,
        role: r.role,
        addedAt: r.added_at,
      })),
    })
  },
  { minRole: 'site_admin' },
)

// POST /api/projects/[id]/members — add a user to the project (site_admin+)
export const POST = withAuth(
  async (req, session, ctx) => {
    const projectId = ctx.params?.id as string
    const { userId } = await req.json() as { userId?: string }

    if (!userId) return apiError.badRequest('userId is required')

    const project = await queryOne<{ id: string; org_id: string }>(
      'SELECT id, org_id FROM projects WHERE id = $1',
      [projectId],
    )
    if (!project) return apiError.notFound('Project not found')

    // site_admin can only manage projects within their own org
    if (!hasMinRole(session.user.role, 'org_admin') && project.org_id !== session.user.orgId) {
      return apiError.forbidden()
    }

    const user = await queryOne<{ id: string }>('SELECT id FROM users WHERE id = $1', [userId])
    if (!user) return apiError.notFound('User not found')

    await query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [projectId, userId],
    )

    return NextResponse.json({ ok: true }, { status: 201 })
  },
  { minRole: 'site_admin' },
)
