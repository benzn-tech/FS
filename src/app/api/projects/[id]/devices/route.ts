import { withAuth, apiError } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/projects/[id]/devices
export const GET = withAuth(
  async (_req, _session, ctx) => {
    const projectId = ctx.params?.id as string

    const project = await queryOne<{ id: string }>('SELECT id FROM projects WHERE id = $1', [projectId])
    if (!project) return apiError.notFound('Project not found')

    const rows = await query<{ id: string; device_account: string; user_id: string | null; user_name: string | null; user_email: string | null; created_at: string }>(
      `SELECT pd.id, pd.device_account, pd.user_id, u.name AS user_name, u.email AS user_email, pd.created_at
         FROM project_devices pd
         LEFT JOIN users u ON u.id = pd.user_id
        WHERE pd.project_id = $1
        ORDER BY pd.created_at ASC`,
      [projectId],
    )

    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        deviceAccount: r.device_account,
        userId: r.user_id ?? null,
        userName: r.user_name ?? null,
        userEmail: r.user_email ?? null,
        createdAt: r.created_at,
      })),
    })
  },
  { minRole: 'org_admin' },
)

// POST /api/projects/[id]/devices — map a device to this project (org_admin+)
export const POST = withAuth(
  async (req, _session, ctx) => {
    const projectId = ctx.params?.id as string
    const { deviceAccount, userId } = await req.json() as { deviceAccount?: string; userId?: string | null }

    if (!deviceAccount?.trim()) return apiError.badRequest('deviceAccount is required')

    const project = await queryOne<{ id: string; org_id: string }>('SELECT id, org_id FROM projects WHERE id = $1', [projectId])
    if (!project) return apiError.notFound('Project not found')

    // Check if device is already mapped elsewhere (to inform the response)
    const existing = await queryOne<{ project_id: string; project_name: string }>(
      `SELECT pd.project_id, p.name AS project_name
         FROM project_devices pd
         JOIN projects p ON p.id = pd.project_id
        WHERE pd.device_account = $1`,
      [deviceAccount.trim()],
    )
    const reassigned = !!existing && existing.project_id !== projectId
    const previousProject = reassigned ? existing!.project_name : null

    // If userId provided, verify they belong to the same org
    if (userId) {
      const user = await queryOne<{ id: string }>(
        'SELECT id FROM users WHERE id = $1 AND org_id = $2',
        [userId, project.org_id],
      )
      if (!user) return apiError.badRequest('User not found in this organisation')
    }

    const row = await queryOne<{ id: string; device_account: string; user_id: string | null; created_at: string }>(
      `INSERT INTO project_devices (project_id, device_account, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (device_account) DO UPDATE
         SET project_id = EXCLUDED.project_id,
             user_id = EXCLUDED.user_id
       RETURNING id, device_account, user_id, created_at`,
      [projectId, deviceAccount.trim(), userId ?? null],
    )

    return NextResponse.json({
      data: { id: row!.id, deviceAccount: row!.device_account, userId: row!.user_id, createdAt: row!.created_at },
      reassigned,
      previousProject,
    }, { status: 201 })
  },
  { minRole: 'super_admin' },
)
