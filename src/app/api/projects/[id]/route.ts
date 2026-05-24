import { withAuth, apiError } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

// Helper: check if user can access this project
async function canAccess(
  projectId: string,
  userId: string,
  role: string,
  orgId: string,
): Promise<boolean> {
  if (role === 'super_admin') return true

  const project = await queryOne<{ org_id: string }>(
    'SELECT org_id FROM projects WHERE id = $1',
    [projectId],
  )
  if (!project) return false
  if (project.org_id !== orgId) return false

  if (role === 'org_admin') return true

  const membership = await queryOne(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId],
  )
  return !!membership
}

// GET /api/projects/[id]
export const GET = withAuth(async (_req, session, ctx) => {
  const projectId = ctx.params?.id as string

  const ok = await canAccess(projectId, session.user.id, session.user.role, session.user.orgId)
  if (!ok) return apiError.notFound('Project not found')

  const project = await queryOne<{
    id: string; org_id: string; org_name: string; name: string
    address: string | null; status: string; created_at: string; updated_at: string
    latitude: string | null; longitude: string | null
  }>(
    `SELECT p.id, p.org_id, o.name AS org_name, p.name, p.address, p.status,
            p.created_at, p.updated_at, p.latitude, p.longitude
       FROM projects p
       JOIN organisations o ON o.id = p.org_id
      WHERE p.id = $1`,
    [projectId],
  )
  if (!project) return apiError.notFound('Project not found')

  return NextResponse.json({
    data: {
      id: project.id,
      orgId: project.org_id,
      orgName: project.org_name,
      name: project.name,
      address: project.address ?? undefined,
      status: project.status,
      latitude: project.latitude != null ? parseFloat(project.latitude) : undefined,
      longitude: project.longitude != null ? parseFloat(project.longitude) : undefined,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    },
  })
})

// PATCH /api/projects/[id] — update name/address/status/thumbnail_url (site_admin+)
export const PATCH = withAuth(
  async (req, session, ctx) => {
    const projectId = ctx.params?.id as string
    const body = await req.json()
    const { name, address, status, thumbnailUrl, latitude, longitude } = body as {
      name?: string; address?: string; status?: string; thumbnailUrl?: string | null
      latitude?: number | null; longitude?: number | null
    }

    const ok = await canAccess(projectId, session.user.id, session.user.role, session.user.orgId)
    if (!ok) return apiError.notFound('Project not found')

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM projects WHERE id = $1',
      [projectId],
    )
    if (!existing) return apiError.notFound('Project not found')

    const updates: string[] = []
    const values: unknown[] = []
    let i = 1

    const canManage = session.user.role === 'super_admin' || session.user.role === 'org_admin'

    // name/address/coords — org_admin+ only; status — super_admin only
    if (name !== undefined) {
      if (!canManage) return apiError.forbidden('Insufficient permissions')
      updates.push(`name = $${i++}`); values.push(name.trim())
    }
    if (address !== undefined) {
      if (!canManage) return apiError.forbidden('Insufficient permissions')
      updates.push(`address = $${i++}`); values.push(address.trim() || null)
    }
    if (status !== undefined) {
      if (session.user.role !== 'super_admin') return apiError.forbidden('Insufficient permissions')
      if (!['active', 'archived'].includes(status)) return apiError.badRequest('Invalid status')
      updates.push(`status = $${i++}`); values.push(status)
    }
    if (thumbnailUrl !== undefined) {
      updates.push(`thumbnail_url = $${i++}`); values.push(thumbnailUrl)
    }
    if (latitude !== undefined) {
      if (!canManage) return apiError.forbidden('Insufficient permissions')
      if (latitude !== null) {
        const lat = Number(latitude)
        if (isNaN(lat) || lat < -90 || lat > 90) return apiError.badRequest('latitude must be between -90 and 90')
        updates.push(`latitude = $${i++}`); values.push(lat)
      } else {
        updates.push(`latitude = $${i++}`); values.push(null)
      }
    }
    if (longitude !== undefined) {
      if (!canManage) return apiError.forbidden('Insufficient permissions')
      if (longitude !== null) {
        const lng = Number(longitude)
        if (isNaN(lng) || lng < -180 || lng > 180) return apiError.badRequest('longitude must be between -180 and 180')
        updates.push(`longitude = $${i++}`); values.push(lng)
      } else {
        updates.push(`longitude = $${i++}`); values.push(null)
      }
    }

    if (updates.length === 0) return apiError.badRequest('Nothing to update')

    updates.push(`updated_at = NOW()`)
    values.push(projectId)

    await query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${i}`,
      values,
    )

    return NextResponse.json({ ok: true })
  },
  { minRole: 'site_admin' },
)

// DELETE /api/projects/[id] (super_admin only)
export const DELETE = withAuth(
  async (_req, _session, ctx) => {
    const projectId = ctx.params?.id as string

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM projects WHERE id = $1',
      [projectId],
    )
    if (!existing) return apiError.notFound('Project not found')

    await query('DELETE FROM projects WHERE id = $1', [projectId])

    return NextResponse.json({ ok: true })
  },
  { minRole: 'super_admin' },
)
