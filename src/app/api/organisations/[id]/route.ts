import { withAuth, apiError } from '@/lib/api-helpers'
import { queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

// PATCH /api/organisations/[id] — rename org (super_admin only)
export const PATCH = withAuth(
  async (req, _session, ctx) => {
    const orgId = ctx.params?.id as string
    const { name } = await req.json() as { name?: string }
    if (!name?.trim()) return apiError.badRequest('name is required')

    const org = await queryOne<{ id: string; name: string }>(
      'SELECT id FROM organisations WHERE id = $1',
      [orgId],
    )
    if (!org) return apiError.notFound('Organisation not found')

    const updated = await queryOne<{ id: string; name: string }>(
      'UPDATE organisations SET name = $1 WHERE id = $2 RETURNING id, name',
      [name.trim(), orgId],
    )

    return NextResponse.json({ data: updated })
  },
  { minRole: 'super_admin' },
)
