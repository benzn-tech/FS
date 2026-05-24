import { withAuth, apiError, hasMinRole } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

// DELETE /api/projects/[id]/members/[userId]
export const DELETE = withAuth(
  async (_req, session, ctx) => {
    const projectId = ctx.params?.id as string
    const userId = ctx.params?.userId as string

    const project = await queryOne<{ id: string; org_id: string }>(
      'SELECT id, org_id FROM projects WHERE id = $1',
      [projectId],
    )
    if (!project) return apiError.notFound('Project not found')

    if (!hasMinRole(session.user.role, 'org_admin') && project.org_id !== session.user.orgId) {
      return apiError.forbidden()
    }

    await query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId],
    )

    return NextResponse.json({ ok: true })
  },
  { minRole: 'site_admin' },
)
