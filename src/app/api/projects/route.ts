import { withAuth, apiError } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/projects — list projects accessible to the current user
export const GET = withAuth(async (_req, session) => {
  const { role, orgId, id: userId } = session.user

  let rows: { id: string; org_id: string; name: string; address: string | null; status: string; created_at: string }[]

  if (role === 'super_admin') {
    // super_admin sees all projects
    rows = await query(
      `SELECT id, org_id, name, address, status, created_at
         FROM projects
        ORDER BY created_at DESC`,
    )
  } else if (role === 'org_admin') {
    // org_admin sees all projects in their org
    rows = await query(
      `SELECT id, org_id, name, address, status, created_at
         FROM projects
        WHERE org_id = $1
        ORDER BY created_at DESC`,
      [orgId],
    )
  } else {
    // Everyone else only sees projects they're a member of (within their org)
    rows = await query(
      `SELECT p.id, p.org_id, p.name, p.address, p.status, p.created_at
         FROM projects p
         JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = $1
          AND p.org_id = $2
        ORDER BY p.created_at DESC`,
      [userId, orgId],
    )
  }

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      orgId: r.org_id,
      name: r.name,
      address: r.address ?? undefined,
      status: r.status,
      createdAt: r.created_at,
    })),
  })
})

// POST /api/projects — create a new project (super_admin only)
export const POST = withAuth(
  async (req, session) => {
    const body = await req.json()
    const { orgId, name, address } = body as { orgId?: string; name?: string; address?: string }

    if (!orgId || !name) return apiError.badRequest('orgId and name are required')

    // Verify the org exists
    const org = await queryOne<{ id: string }>('SELECT id FROM organisations WHERE id = $1', [orgId])
    if (!org) return apiError.notFound('Organisation not found')

    const project = await queryOne<{ id: string; org_id: string; name: string; address: string | null; status: string; created_at: string }>(
      `INSERT INTO projects (org_id, name, address)
       VALUES ($1, $2, $3)
       RETURNING id, org_id, name, address, status, created_at`,
      [orgId, name.trim(), address?.trim() ?? null],
    )

    return NextResponse.json({
      data: {
        id: project!.id,
        orgId: project!.org_id,
        name: project!.name,
        address: project!.address ?? undefined,
        status: project!.status,
        createdAt: project!.created_at,
      },
    }, { status: 201 })
  },
  { minRole: 'super_admin' },
)
