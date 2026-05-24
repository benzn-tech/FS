import { withAuth, apiError } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

// DELETE /api/projects/[id]/devices/[deviceId]
export const DELETE = withAuth(
  async (_req, _session, ctx) => {
    const projectId = ctx.params?.id as string
    const deviceId = ctx.params?.deviceId as string

    const device = await queryOne<{ id: string }>(
      'SELECT id FROM project_devices WHERE id = $1 AND project_id = $2',
      [deviceId, projectId],
    )
    if (!device) return apiError.notFound('Device mapping not found')

    await query('DELETE FROM project_devices WHERE id = $1', [deviceId])

    return NextResponse.json({ ok: true })
  },
  { minRole: 'org_admin' },
)
