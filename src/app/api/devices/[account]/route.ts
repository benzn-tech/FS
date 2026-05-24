import { withAuth, apiError } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

// PATCH /api/devices/[account]
// Update a device: move to a different org, update label, assign/reassign project + user.
// Moving org clears any existing project_devices mapping (cross-org reassignment).
export const PATCH = withAuth(
  async (req, _session, ctx) => {
    const deviceAccount = ctx.params?.account as string
    const body = await req.json() as {
      orgId?: string
      label?: string | null
      projectId?: string | null
      userId?: string | null
    }

    const device = await queryOne<{ id: string; org_id: string }>(
      'SELECT id, org_id FROM org_devices WHERE device_account = $1',
      [deviceAccount],
    )
    if (!device) return apiError.notFound('Device not found')

    // --- Org reassignment ---
    let newOrgId = device.org_id
    if (body.orgId !== undefined && body.orgId !== device.org_id) {
      const org = await queryOne<{ id: string }>(
        'SELECT id FROM organisations WHERE id = $1',
        [body.orgId],
      )
      if (!org) return apiError.notFound('Target organisation not found')
      newOrgId = body.orgId!

      // Moving to a different org → drop any existing project mapping
      // (the project belongs to the old org; the device can't stay mapped there)
      await query('DELETE FROM project_devices WHERE device_account = $1', [deviceAccount])
    }

    // --- Update org_devices row ---
    const updates: string[] = ['updated_at = NOW()']
    const values: unknown[] = []
    let idx = 1

    if (body.orgId !== undefined) { updates.push(`org_id = $${idx++}`); values.push(newOrgId) }
    if (body.label !== undefined) { updates.push(`label = $${idx++}`); values.push(body.label ?? null) }

    if (updates.length > 1) {
      values.push(deviceAccount)
      await query(
        `UPDATE org_devices SET ${updates.join(', ')} WHERE device_account = $${idx}`,
        values,
      )
    }

    // --- Project / user mapping ---
    if (body.projectId !== undefined) {
      if (body.projectId === null) {
        // Unmap from project entirely
        await query('DELETE FROM project_devices WHERE device_account = $1', [deviceAccount])
      } else {
        // Verify project belongs to the (new) org
        const project = await queryOne<{ id: string; org_id: string }>(
          'SELECT id, org_id FROM projects WHERE id = $1',
          [body.projectId],
        )
        if (!project) return apiError.notFound('Project not found')
        if (project.org_id !== newOrgId) {
          return apiError.badRequest('Project does not belong to the device\'s organisation')
        }

        // Verify user (if provided) belongs to the same org
        if (body.userId) {
          const user = await queryOne<{ id: string }>(
            'SELECT id FROM users WHERE id = $1 AND org_id = $2',
            [body.userId, newOrgId],
          )
          if (!user) return apiError.badRequest('User not found in this organisation')
        }

        await query(
          `INSERT INTO project_devices (project_id, device_account, user_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (device_account) DO UPDATE
             SET project_id = EXCLUDED.project_id,
                 user_id    = EXCLUDED.user_id`,
          [body.projectId, deviceAccount, body.userId ?? null],
        )
      }
    }

    // Return updated device with full context
    const updated = await queryOne<{
      id: string; org_id: string; org_name: string
      device_account: string; label: string | null; created_at: string
      project_id: string | null; project_name: string | null
      user_id: string | null; user_name: string | null; user_email: string | null
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
        WHERE od.device_account = $1`,
      [deviceAccount],
    )

    return NextResponse.json({ data: updated })
  },
  { minRole: 'super_admin' },
)

// DELETE /api/devices/[account]
// Remove a device from its org entirely. Also removes any project_devices mapping.
export const DELETE = withAuth(
  async (_req, _session, ctx) => {
    const deviceAccount = ctx.params?.account as string

    const device = await queryOne<{ id: string }>(
      'SELECT id FROM org_devices WHERE device_account = $1',
      [deviceAccount],
    )
    if (!device) return apiError.notFound('Device not found')

    // project_devices has no FK to org_devices, so delete explicitly
    await query('DELETE FROM project_devices WHERE device_account = $1', [deviceAccount])
    await query('DELETE FROM org_devices WHERE device_account = $1', [deviceAccount])

    return NextResponse.json({ ok: true })
  },
  { minRole: 'super_admin' },
)
