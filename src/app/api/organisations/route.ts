import { withAuth, apiError } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/organisations — create a new org (super_admin only)
export const POST = withAuth(
  async (req) => {
    const { name } = await req.json() as { name?: string }
    if (!name?.trim()) return apiError.badRequest('name is required')

    const org = await queryOne<{ id: string; name: string }>(
      `INSERT INTO organisations (name) VALUES ($1) RETURNING id, name`,
      [name.trim()],
    )

    return NextResponse.json({ data: org }, { status: 201 })
  },
  { minRole: 'super_admin' },
)

// GET /api/organisations — list all orgs (super_admin only)
export const GET = withAuth(
  async () => {
    const rows = await query<{ id: string; name: string }>(
      'SELECT id, name FROM organisations ORDER BY name ASC',
    )
    return NextResponse.json({ data: rows })
  },
  { minRole: 'super_admin' },
)
