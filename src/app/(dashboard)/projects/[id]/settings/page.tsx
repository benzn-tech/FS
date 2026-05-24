export const dynamic = 'force-dynamic'

import { type Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { queryOne, query } from '@/lib/db'
import { hasMinRole } from '@/lib/api-helpers'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { ArrowLeft, Settings, Users, Cpu, MapPin, Archive } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import { ProjectSettingsForm } from './ProjectSettingsForm'
import { AddMemberForm } from '../AddMemberForm'
import { ProjectDevicesPanel } from '../ProjectDevicesPanel'

export const metadata: Metadata = { title: 'Project Settings' }

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role, orgId, id: userId } = session.user

  if (!hasMinRole(role, 'site_admin')) redirect(`/projects/${projectId}`)

  const project = await queryOne<{
    id: string; org_id: string; org_name: string; name: string
    address: string | null; status: string; thumbnail_url: string | null
    latitude: string | null; longitude: string | null
  }>(
    `SELECT p.id, p.org_id, o.name AS org_name, p.name, p.address, p.status,
            p.thumbnail_url, p.latitude, p.longitude
       FROM projects p
       JOIN organisations o ON o.id = p.org_id
      WHERE p.id = $1`,
    [projectId],
  )

  if (!project) notFound()

  const isSuperAdmin = role === 'super_admin'
  const isOrgAdmin = role === 'org_admin'
  const canManage = isSuperAdmin || isOrgAdmin
  const inSameOrg = project.org_id === orgId

  if (!isSuperAdmin) {
    if (!inSameOrg) notFound()
    if (!isOrgAdmin) {
      const membership = await queryOne(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, userId],
      )
      if (!membership) notFound()
    }
  }

  // Members
  const members = await query<{ user_id: string; email: string; name: string | null; role: string }>(
    `SELECT pm.user_id, u.email, u.name, u.role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
      ORDER BY pm.added_at ASC`,
    [projectId],
  )

  // Org users for add-member picker (org_admin+ can see their org's users)
  const orgUsers = canManage
    ? await query<{ id: string; email: string; name: string | null }>(
        'SELECT id, email, name FROM users WHERE org_id = $1 ORDER BY name ASC',
        [project.org_id],
      )
    : []

  // Devices (org_admin+)
  const devices = canManage
    ? await query<{ id: string; device_account: string; user_id: string | null; user_name: string | null; user_email: string | null }>(
        `SELECT pd.id, pd.device_account, pd.user_id, u.name AS user_name, u.email AS user_email
           FROM project_devices pd
           LEFT JOIN users u ON u.id = pd.user_id
          WHERE pd.project_id = $1
          ORDER BY pd.created_at ASC`,
        [projectId],
      )
    : []

  const orgDevices = canManage
    ? await query<{ device_account: string; label: string | null }>(
        'SELECT device_account, label FROM org_devices WHERE org_id = $1 ORDER BY device_account ASC',
        [project.org_id],
      )
    : []

  const orgUsersNotMember = orgUsers.filter((u) => !members.some((m) => m.user_id === u.id))

  async function setStatus(formData: FormData) {
    'use server'
    const s = await auth()
    if (!s?.user || s.user.role !== 'super_admin') return
    const status = formData.get('status') as string
    if (!['active', 'archived'].includes(status)) return
    await queryOne('UPDATE projects SET status = $1 WHERE id = $2', [status, projectId])
    revalidatePath(`/projects/${projectId}/settings`)
  }

  async function removeMember(formData: FormData) {
    'use server'
    const s = await auth()
    if (!s?.user) return
    if (s.user.role !== 'super_admin' && s.user.role !== 'org_admin') return
    const uid = formData.get('userId') as string
    await queryOne('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, uid])
    revalidatePath(`/projects/${projectId}/settings`)
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111827] mb-3"
        >
          <ArrowLeft size={14} />
          Back to {project.name}
        </Link>
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-[#6B7280]" />
          <h1 className="text-xl font-bold text-[#111827]">Project Settings</h1>
        </div>
        <p className="text-sm text-[#6B7280] mt-1">{project.name}</p>
      </div>

      {/* Project details */}
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E5E7EB]">
          <MapPin size={14} className="text-[#6B7280]" />
          <h2 className="text-sm font-semibold text-[#111827]">Project Details</h2>
        </div>
        <ProjectSettingsForm
          projectId={projectId}
          initialName={project.name}
          initialAddress={project.address}
          initialLatitude={project.latitude != null ? parseFloat(project.latitude) : null}
          initialLongitude={project.longitude != null ? parseFloat(project.longitude) : null}
          canEdit={canManage}
        />
      </Card>

      {/* Status — super_admin only */}
      {isSuperAdmin && (
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E5E7EB]">
            <Archive size={14} className="text-[#6B7280]" />
            <h2 className="text-sm font-semibold text-[#111827]">Project Status</h2>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[#374151]">
                Current status:{' '}
                <span className={`font-semibold ${project.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                  {project.status}
                </span>
              </p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Archived projects remain visible but are marked as inactive.
              </p>
            </div>
            <form action={setStatus}>
              <input type="hidden" name="status" value={project.status === 'active' ? 'archived' : 'active'} />
              <button
                type="submit"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  project.status === 'active'
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-[#FFD966] text-[#111827] hover:bg-[#FFC107]'
                }`}
              >
                <Archive size={14} />
                {project.status === 'active' ? 'Archive project' : 'Restore to active'}
              </button>
            </form>
          </div>
        </Card>
      )}

      {/* Members */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
          <Users size={15} className="text-[#6B7280]" />
          <h2 className="text-sm font-semibold text-[#111827]">Members ({members.length})</h2>
        </div>
        {members.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-[#6B7280]">No members added yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Role</th>
                {canManage && <th className="px-6 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {members.map((m) => (
                <tr key={m.user_id} className="hover:bg-[#F9FAFB]">
                  <td className="px-6 py-3">
                    <p className="font-medium text-[#111827]">{m.name ?? '—'}</p>
                    <p className="text-xs text-[#6B7280]">{m.email}</p>
                  </td>
                  <td className="px-6 py-3 text-xs text-[#6B7280] capitalize">{m.role.replace('_', ' ')}</td>
                  {canManage && (
                    <td className="px-6 py-3 text-right">
                      <form action={removeMember}>
                        <input type="hidden" name="userId" value={m.user_id} />
                        <button
                          type="submit"
                          className="text-xs text-[#6B7280] hover:text-[#EF4444] transition-colors px-2 py-1 rounded"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canManage && (
          <div className="px-6 py-4 border-t border-[#E5E7EB]">
            <AddMemberForm projectId={projectId} orgUsers={orgUsersNotMember} />
          </div>
        )}
      </Card>

      {/* Devices */}
      {canManage && (
        <Card padding="none">
          <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
            <Cpu size={15} className="text-[#6B7280]" />
            <h2 className="text-sm font-semibold text-[#111827]">Devices ({devices.length})</h2>
          </div>
          <p className="px-6 pt-3 pb-1 text-xs text-[#6B7280]">
            Map RealPTT device accounts to this project.
          </p>
          <ProjectDevicesPanel
            projectId={projectId}
            mappedDevices={devices.map((d) => ({
              id: d.id,
              deviceAccount: d.device_account,
              userId: d.user_id,
              userName: d.user_name,
              userEmail: d.user_email,
            }))}
            orgDevices={orgDevices.map((d) => ({ deviceAccount: d.device_account, label: d.label }))}
            orgUsers={orgUsers.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
          />
        </Card>
      )}
    </div>
  )
}
