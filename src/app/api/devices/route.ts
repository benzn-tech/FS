import { withAuth, apiError } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/devices
// Returns all org_devices across all orgs (super_admin) or scoped to caller's org (org_admin).
// Each row includes: org info, current project mapping, and assigned user.
export const GET = withAuth(
  async (_req, session) => {
    const isSuperAdmin = session.user.role === 'super_admin'

    const rows = await query<{
      id: string
      org_id: string
      org_name: string
      device_account: string
      label: string | null
      created_at: string
      // current project mapping (from project_devices)
      project_id: string | null
      project_name: string | null
      // assigned user (from project_devices.user_id)
      user_id: string | null
      user_name: string | null
      user_email: string | null
    }>(
      `SELECT od.id, od.org_id, o.name AS org_name,
              od.device_account, od.label, od.created_at,
              pd.project_id, p.name AS project_name,
              pd.user_id, u.name AS user_name, u.email AS user_email
         FROM org_devices od
         JOIN organisations o ON o.id = od.org_id
         LEFT JOIN project_devices pd ON pd.device_account = od.device_account
         LEFT JOIN projects p ON p.id = pd.project_id
         LEFT JOIN users u ON u.id = pd.user_id
        ${isSuperAdmin ? '' : 'WHERE od.org_id = $1'}
        ORDER BY o.name ASC, od.device_account ASC`,
      isSuperAdmin ? [] : [session.user.orgId],
    )

    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        orgId: r.org_id,
        orgName: r.org_name,
        deviceAccount: r.device_account,
        label: r.label ?? null,
        createdAt: r.created_at,
        projectId: r.project_id ?? null,
        projectName: r.project_name ?? null,
        userId: r.user_id ?? null,
        userName: r.user_name ?? null,
        userEmail: r.user_email ?? null,
      })),
    })
  },
  { minRole: 'org_admin' },
)

// POST /api/devices
// Add a new device to an org. super_admin can specify any orgId; org_admin scoped to own org.
export const POST = withAuth(
  async (req, session) => {
    const isSuperAdmin = session.user.role === 'super_admin'
    const body = await req.json() as { deviceAccount?: string; orgId?: string; label?: string }

    if (!body.deviceAccount?.trim()) return apiError.badRequest('deviceAccount is required')

    const targetOrgId = isSuperAdmin ? body.orgId : session.user.orgId
    if (!targetOrgId) return apiError.badRequest('orgId is required')

    const org = await queryOne<{ id: string }>(
      'SELECT id FROM organisations WHERE id = $1',
      [targetOrgId],
    )
    if (!org) return apiError.notFound('Organisation not found')

    // Check if already assigned to a different org
    const existing = await queryOne<{ org_id: string; org_name: string }>(
      `SELECT od.org_id, o.name AS org_name
         FROM org_devices od
         JOIN organisations o ON o.id = od.org_id
        WHERE od.device_account = $1`,
      [body.deviceAccount.trim()],
    )
    if (existing && existing.org_id !== targetOrgId) {
      return apiError.badRequest(
        `Device "${body.deviceAccount.trim()}" is already assigned to organisation "${existing.org_name}". Reassign it from there first.`,
      )
    }

    const row = await queryOne<{ id: string; device_account: string; label: string | null; created_at: string }>(
      `INSERT INTO org_devices (org_id, device_account, label)
       VALUES ($1, $2, $3)
       ON CONFLICT (device_account) DO UPDATE
         SET org_id = EXCLUDED.org_id,
             label  = COALESCE(EXCLUDED.label, org_devices.label),
             updated_at = NOW()
       RETURNING id, device_account, label, created_at`,
      [targetOrgId, body.deviceAccount.trim(), body.label?.trim() ?? null],
    )

    return NextResponse.json({ data: row }, { status: 201 })
  },
  { minRole: 'super_admin' },
)
