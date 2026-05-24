'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Cpu, Plus, Pencil, Trash2, ChevronDown, Building2, FolderOpen, User, X, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface OrgOption { id: string; name: string }
interface ProjectOption { id: string; name: string; orgId: string }
interface UserOption { id: string; name: string | null; email: string; orgId: string }

interface Device {
  id: string
  orgId: string
  orgName: string
  deviceAccount: string
  label: string | null
  createdAt: string
  projectId: string | null
  projectName: string | null
  userId: string | null
  userName: string | null
  userEmail: string | null
}

interface Props {
  devices: Device[]
  orgs: OrgOption[]
  projects: ProjectOption[]
  users: UserOption[]
}

// ---------------------------------------------------------------------------
// Add Device Form
// ---------------------------------------------------------------------------
function AddDeviceForm({ orgs, onAdded }: { orgs: OrgOption[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [deviceAccount, setDeviceAccount] = useState('')
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? '')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!deviceAccount.trim() || !orgId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceAccount: deviceAccount.trim(), orgId, label: label.trim() || null }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to add device')
      } else {
        setDeviceAccount('')
        setLabel('')
        setOrgId(orgs[0]?.id ?? '')
        setOpen(false)
        onAdded()
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] transition-colors"
      >
        <Plus size={14} />
        Add Device
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 flex-wrap">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#6B7280]">RealPTT Account</span>
        <input
          type="text"
          value={deviceAccount}
          onChange={(e) => setDeviceAccount(e.target.value)}
          placeholder="e.g. Benl1"
          className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966] font-mono w-36"
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#6B7280]">Label (optional)</span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Camera 3"
          className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966] w-36"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#6B7280]">Organisation</span>
        <select
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
        >
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2 pb-0.5">
        <button
          type="submit"
          disabled={!deviceAccount.trim() || !orgId || loading}
          className="px-3 py-1.5 text-sm font-medium bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError('') }}
          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      {error && <p className="w-full text-xs text-[#EF4444]">{error}</p>}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Inline edit row
// ---------------------------------------------------------------------------
interface EditState {
  label: string
  orgId: string
  projectId: string
  userId: string
}

function DeviceRow({
  device,
  orgs,
  projects,
  users,
  onChanged,
  onDeleted,
}: {
  device: Device
  orgs: OrgOption[]
  projects: ProjectOption[]
  users: UserOption[]
  onChanged: () => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [edit, setEdit] = useState<EditState>({
    label: device.label ?? '',
    orgId: device.orgId,
    projectId: device.projectId ?? '',
    userId: device.userId ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Projects filtered to the selected org
  const orgProjects = useMemo(
    () => projects.filter((p) => p.orgId === edit.orgId),
    [projects, edit.orgId],
  )

  // Users filtered to the selected org
  const orgUsers = useMemo(
    () => users.filter((u) => u.orgId === edit.orgId),
    [users, edit.orgId],
  )

  function startEdit() {
    setEdit({
      label: device.label ?? '',
      orgId: device.orgId,
      projectId: device.projectId ?? '',
      userId: device.userId ?? '',
    })
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setError('')
    setConfirmDelete(false)
  }

  // When org changes, clear project + user (they belong to old org)
  function handleOrgChange(newOrgId: string) {
    setEdit((prev) => ({ ...prev, orgId: newOrgId, projectId: '', userId: '' }))
  }

  // When project changes, clear user selection
  function handleProjectChange(newProjectId: string) {
    setEdit((prev) => ({ ...prev, projectId: newProjectId, userId: '' }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        label: edit.label.trim() || null,
        orgId: edit.orgId,
        projectId: edit.projectId || null,
        userId: edit.userId || null,
      }
      const res = await fetch(`/api/devices/${encodeURIComponent(device.deviceAccount)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to save')
      } else {
        setEditing(false)
        onChanged()
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(device.deviceAccount)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to delete')
        setDeleting(false)
      } else {
        onDeleted()
      }
    } catch {
      setError('Network error')
      setDeleting(false)
    }
  }

  if (!editing) {
    return (
      <tr className="hover:bg-[#F9FAFB] transition-colors group">
        {/* Device account */}
        <td className="px-6 py-3">
          <p className="font-mono text-sm text-[#111827]">{device.deviceAccount}</p>
          {device.label && <p className="text-xs text-[#6B7280] mt-0.5">{device.label}</p>}
        </td>
        {/* Org */}
        <td className="px-6 py-3">
          <div className="flex items-center gap-1.5 text-sm text-[#111827]">
            <Building2 size={13} className="text-[#6B7280] flex-shrink-0" />
            {device.orgName}
          </div>
        </td>
        {/* Project */}
        <td className="px-6 py-3">
          {device.projectName ? (
            <div className="flex items-center gap-1.5 text-sm text-[#111827]">
              <FolderOpen size={13} className="text-[#6B7280] flex-shrink-0" />
              {device.projectName}
            </div>
          ) : (
            <span className="text-sm italic text-[#9CA3AF]">Unassigned</span>
          )}
        </td>
        {/* User */}
        <td className="px-6 py-3">
          {device.userName || device.userEmail ? (
            <div className="flex items-center gap-1.5 text-sm text-[#111827]">
              <User size={13} className="text-[#6B7280] flex-shrink-0" />
              {device.userName ?? device.userEmail}
            </div>
          ) : (
            <span className="text-sm italic text-[#9CA3AF]">None</span>
          )}
        </td>
        {/* Actions */}
        <td className="px-6 py-3 text-right">
          <button
            onClick={startEdit}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
            title="Edit device"
          >
            <Pencil size={14} />
          </button>
        </td>
      </tr>
    )
  }

  // Edit mode — spans the whole row
  return (
    <tr className="bg-[#FFFBEB] border-b border-[#E5E7EB]">
      <td colSpan={5} className="px-6 py-4">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
            Editing — <span className="font-mono">{device.deviceAccount}</span>
          </p>

          <div className="flex flex-wrap gap-3">
            {/* Label */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#6B7280]">Label</span>
              <input
                type="text"
                value={edit.label}
                onChange={(e) => setEdit((p) => ({ ...p, label: e.target.value }))}
                placeholder="e.g. Camera 3"
                className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966] w-40"
              />
            </label>

            {/* Organisation */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#6B7280]">Organisation</span>
              <div className="relative">
                <select
                  value={edit.orgId}
                  onChange={(e) => handleOrgChange(e.target.value)}
                  className="text-sm pl-3 pr-8 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966] appearance-none"
                >
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
              </div>
              {edit.orgId !== device.orgId && (
                <p className="text-xs text-amber-600 mt-0.5">Moving org will unmap current project</p>
              )}
            </label>

            {/* Project */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#6B7280]">Project</span>
              <div className="relative">
                <select
                  value={edit.projectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="text-sm pl-3 pr-8 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966] appearance-none"
                >
                  <option value="">— Unassigned —</option>
                  {orgProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
              </div>
            </label>

            {/* User */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#6B7280]">Camera User</span>
              <div className="relative">
                <select
                  value={edit.userId}
                  onChange={(e) => setEdit((p) => ({ ...p, userId: e.target.value }))}
                  disabled={!edit.projectId}
                  className="text-sm pl-3 pr-8 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966] appearance-none disabled:opacity-50"
                >
                  <option value="">— None —</option>
                  {orgUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
              </div>
            </label>
          </div>

          {error && <p className="text-xs text-[#EF4444]">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] disabled:opacity-50 transition-colors"
            >
              <Check size={13} />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={cancelEdit}
              className="px-3 py-1.5 text-sm text-[#6B7280] hover:text-[#111827] rounded-lg hover:bg-[#F3F4F6] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                confirmDelete
                  ? 'bg-[#EF4444] text-white hover:bg-red-600'
                  : 'text-[#EF4444] hover:bg-red-50'
              }`}
            >
              <Trash2 size={13} />
              {confirmDelete ? 'Confirm delete' : 'Remove device'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main shell
// ---------------------------------------------------------------------------
export function DevicesShell({ devices: initialDevices, orgs, projects, users }: Props) {
  const router = useRouter()
  const [filterOrg, setFilterOrg] = useState<string>('all')

  function refresh() { router.refresh() }

  const filtered = filterOrg === 'all'
    ? initialDevices
    : initialDevices.filter((d) => d.orgId === filterOrg)

  const unmappedCount = initialDevices.filter((d) => !d.projectId).length

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Devices</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Manage RealPTT device accounts — assign to organisations and projects
          </p>
        </div>
        <AddDeviceForm orgs={orgs} onAdded={refresh} />
      </div>

      {/* Stats row */}
      <div className="flex gap-4 flex-wrap">
        <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 flex items-center gap-3">
          <Cpu size={18} className="text-[#6B7280]" />
          <div>
            <p className="text-lg font-bold text-[#111827]">{initialDevices.length}</p>
            <p className="text-xs text-[#6B7280]">Total devices</p>
          </div>
        </div>
        {unmappedCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <FolderOpen size={18} className="text-amber-500" />
            <div>
              <p className="text-lg font-bold text-amber-700">{unmappedCount}</p>
              <p className="text-xs text-amber-600">Not mapped to project</p>
            </div>
          </div>
        )}
      </div>

      {/* Org filter */}
      {orgs.length > 1 && (
        <div className="flex gap-1 border-b border-[#E5E7EB] flex-wrap">
          <button
            onClick={() => setFilterOrg('all')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filterOrg === 'all'
                ? 'border-[#FFD966] text-[#111827]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            All orgs
          </button>
          {orgs.map((o) => (
            <button
              key={o.id}
              onClick={() => setFilterOrg(o.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filterOrg === o.id
                  ? 'border-[#FFD966] text-[#111827]'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {o.name}
            </button>
          ))}
        </div>
      )}

      {/* Devices table */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
          <Cpu size={15} className="text-[#6B7280]" />
          <h2 className="text-sm font-semibold text-[#111827]">
            {filtered.length} device{filtered.length !== 1 ? 's' : ''}
            {filterOrg !== 'all' && ` · ${orgs.find((o) => o.id === filterOrg)?.name}`}
          </h2>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Cpu className="mx-auto mb-3 text-[#D1D5DB]" size={36} />
            <p className="text-sm text-[#6B7280]">
              {initialDevices.length === 0
                ? 'No devices yet. Add a device to get started.'
                : 'No devices match the current filter.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Device</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Organisation</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Camera User</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {filtered.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  orgs={orgs}
                  projects={projects}
                  users={users}
                  onChanged={refresh}
                  onDeleted={refresh}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
