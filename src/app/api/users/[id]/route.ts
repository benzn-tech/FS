import { withAuth, apiError, hasMinRole } from '@/lib/api-helpers'
import { ROLE_HIERARCHY } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import { type Role } from '@/types'
import { NextResponse } from 'next/server'

// PATCH /api/users/[id] — update role and/or orgId (orgId: super_admin only)
export const PATCH = withAuth(
  async (req, session, { params }) => {
    const targetId = (params as { id: string }).id
    const body = await req.json()
    const { role, orgId } = body as { role?: Role; orgId?: string }

    const target = await queryOne<{ id: string; org_id: string; role: string }>(
      'SELECT id, org_id, role FROM users WHERE id = $1',
      [targetId],
    )
    if (!target) return apiError.notFound('User not found')

    const callerRank = ROLE_HIERARCHY[session.user.role]

    // site_admin can only manage users within their own org
    if (!hasMinRole(session.user.role, 'org_admin') && target.org_id !== session.user.orgId) {
      return apiError.forbidden()
    }

    // Cannot modify someone of equal or higher rank
    if (ROLE_HIERARCHY[target.role as Role] >= callerRank) return apiError.forbidden()

    const updates: string[] = []
    const values: unknown[] = []
    let i = 1

    if (role !== undefined) {
      const validRoles: Role[] = ['viewer', 'editor', 'editor_plus', 'site_admin', 'org_admin', 'super_admin']
      if (!validRoles.includes(role)) return apiError.badRequest('Invalid role')
      // super_admin can assign any role including super_admin; others cannot assign their own rank or above
      if (session.user.role !== 'super_admin' && ROLE_HIERARCHY[role] >= callerRank) return apiError.forbidden()
      updates.push(`role = $${i++}`)
      values.push(role)
    }

    if (orgId !== undefined) {
      if (session.user.role !== 'super_admin') return apiError.forbidden('Only super_admin can change organisation')
      const org = await queryOne<{ id: string }>('SELECT id FROM organisations WHERE id = $1', [orgId])
      if (!org) return apiError.notFound('Organisation not found')
      updates.push(`org_id = $${i++}`)
      values.push(orgId)
    }

    if (updates.length === 0) return apiError.badRequest('Nothing to update')

    values.push(targetId)
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`, values)
    return NextResponse.json({ ok: true })
  },
  { minRole: 'site_admin' },
)

// DELETE /api/users/[id] — remove user
export const DELETE = withAuth(
  async (req, session, { params }) => {
    const targetId = (params as { id: string }).id

    if (targetId === session.user.id) return apiError.badRequest('You cannot remove yourself')

    const target = await queryOne<{ id: string; org_id: string; role: string }>(
      'SELECT id, org_id, role FROM users WHERE id = $1',
      [targetId],
    )
    if (!target) return apiError.notFound('User not found')

    // site_admin can only remove users in their own org
    if (!hasMinRole(session.user.role, 'org_admin') && target.org_id !== session.user.orgId) {
      return apiError.forbidden()
    }

    // Cannot remove someone of equal or higher rank
    if (ROLE_HIERARCHY[target.role as Role] >= ROLE_HIERARCHY[session.user.role]) {
      return apiError.forbidden()
    }

    await query('DELETE FROM users WHERE id = $1', [targetId])
    return NextResponse.json({ ok: true })
  },
  { minRole: 'site_admin' },
)
