export const dynamic = 'force-dynamic'

import { type Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { DevicesShell } from './DevicesShell'

export const metadata: Metadata = { title: 'Devices' }

export default async function DevicesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'super_admin') redirect('/dashboard')

  // All org_devices with their current project + user mapping
  const deviceRows = await query<{
    id: string
    org_id: string
    org_name: string
    device_account: string
    label: string | null
    created_at: string
    project_id: string | null
    project_name: string | null
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
      ORDER BY o.name ASC, od.device_account ASC`,
  )

  // All orgs (for org picker)
  const orgRows = await query<{ id: string; name: string }>(
    'SELECT id, name FROM organisations ORDER BY name ASC',
  )

  // All projects (for project picker, filtered client-side by org)
  const projectRows = await query<{ id: string; name: string; org_id: string }>(
    `SELECT id, name, org_id FROM projects WHERE status = 'active' ORDER BY name ASC`,
  )

  // All users (for user picker, filtered client-side by org)
  const userRows = await query<{ id: string; name: string | null; email: string; org_id: string }>(
    'SELECT id, name, email, org_id FROM users ORDER BY name ASC',
  )

  return (
    <DevicesShell
      devices={deviceRows.map((r) => ({
        id: r.id,
        orgId: r.org_id,
        orgName: r.org_name,
        deviceAccount: r.device_account,
        label: r.label,
        createdAt: r.created_at,
        projectId: r.project_id ?? null,
        projectName: r.project_name ?? null,
        userId: r.user_id ?? null,
        userName: r.user_name ?? null,
        userEmail: r.user_email ?? null,
      }))}
      orgs={orgRows}
      projects={projectRows.map((r) => ({ id: r.id, name: r.name, orgId: r.org_id }))}
      users={userRows.map((r) => ({ id: r.id, name: r.name, email: r.email, orgId: r.org_id }))}
    />
  )
}
