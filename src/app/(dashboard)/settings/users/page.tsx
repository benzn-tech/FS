export const dynamic = 'force-dynamic'

import { type Metadata } from 'next'
import { auth } from '@/lib/auth'
import { hasMinRole } from '@/lib/api-helpers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { query } from '@/lib/db'
import { Card } from '@/components/ui/Card'
import { type User, type Role } from '@/types'
import { Trash2 } from 'lucide-react'
import { RoleSelect } from './RoleSelect'
import { OrgSelect } from './OrgSelect'
import { InviteUserForm } from './InviteUserForm'
import { ResendInviteButton } from './ResendInviteButton'

export const metadata: Metadata = { title: 'User Management' }

export default async function UsersPage() {
  const session = await auth()

  if (!session?.user || !hasMinRole(session.user.role, 'site_admin')) {
    redirect('/settings')
  }

  const currentRole = session.user.role
  const isSuperAdmin = currentRole === 'super_admin'

  const assignableRoles: Role[] =
    isSuperAdmin
      ? ['viewer', 'editor', 'editor_plus', 'site_admin', 'org_admin', 'super_admin']
      : currentRole === 'org_admin'
        ? ['viewer', 'editor', 'editor_plus', 'site_admin']
        : ['viewer', 'editor', 'editor_plus']

  // super_admin sees all users across all orgs; others see their own org only
  const rows = isSuperAdmin
    ? await query<{ id: string; org_id: string; org_name: string; email: string; name: string | null; role: string; created_at: string }>(
        `SELECT u.id, u.org_id, o.name AS org_name, u.email, u.name, u.role, u.created_at
           FROM users u
           JOIN organisations o ON o.id = u.org_id
          ORDER BY o.name ASC, u.created_at DESC`,
      )
    : await query<{ id: string; org_id: string; org_name: string; email: string; name: string | null; role: string; created_at: string }>(
        `SELECT u.id, u.org_id, o.name AS org_name, u.email, u.name, u.role, u.created_at
           FROM users u
           JOIN organisations o ON o.id = u.org_id
          WHERE u.org_id = $1
          ORDER BY u.created_at DESC`,
        [session.user.orgId],
      )

  const users: (User & { orgName: string })[] = rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    orgName: r.org_name,
    email: r.email,
    name: r.name ?? undefined,
    role: r.role as Role,
    createdAt: r.created_at,
  }))

  // Orgs for invite form (super_admin gets all, others just their own)
  const orgs = isSuperAdmin
    ? await query<{ id: string; name: string }>('SELECT id, name FROM organisations ORDER BY name ASC')
    : [{ id: session.user.orgId, name: '' }]

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">User Management</h1>
          <p className="text-sm text-[#6B7280] mt-1">Invite users and manage their roles</p>
        </div>
        <InviteUserForm
          assignableRoles={assignableRoles}
          orgs={orgs}
          defaultOrgId={session.user.orgId}
        />
      </div>

      <Card padding="none">
        <div className="px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#111827]">
            {users.length} member{users.length !== 1 ? 's' : ''}
          </h2>
        </div>

        {users.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[#6B7280]">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Role</th>
                {isSuperAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Organisation</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-[#111827]">{user.name ?? '—'}</p>
                    <p className="text-xs text-[#6B7280]">{user.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <RoleSelect
                      userId={user.id}
                      currentRole={user.role}
                      assignableRoles={assignableRoles}
                      disabled={user.id === session.user.id || (!assignableRoles.includes(user.role) && !isSuperAdmin)}
                    />
                  </td>
                  {isSuperAdmin && (
                    <td className="px-6 py-4">
                      <OrgSelect
                        userId={user.id}
                        currentOrgId={user.orgId}
                        orgs={orgs}
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 text-xs text-[#6B7280]">
                    {new Date(user.createdAt).toLocaleDateString('en-AU', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {user.id !== session.user.id && (
                        <ResendInviteButton userId={user.id} />
                      )}
                      <form action={async () => {
                        'use server'
                        const s = await auth()
                        if (!s?.user || !hasMinRole(s.user.role, 'site_admin')) return
                        if (user.id === s.user.id) return
                        await query('DELETE FROM users WHERE id = $1', [user.id])
                        revalidatePath('/settings/users')
                      }}>
                        <button
                          type="submit"
                          disabled={user.id === session.user.id}
                          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#EF4444] hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Remove user"
                        >
                          <Trash2 size={15} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
