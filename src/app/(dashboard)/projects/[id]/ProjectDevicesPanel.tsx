'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, User, Check, X } from 'lucide-react'

interface OrgDevice { deviceAccount: string; label: string | null }
interface OrgUser { id: string; name: string | null; email: string }

interface MappedDevice {
  id: string
  deviceAccount: string
  userId: string | null
  userName: string | null
  userEmail: string | null
}

interface Props {
  projectId: string
  mappedDevices: MappedDevice[]
  orgDevices: OrgDevice[]   // all devices belonging to this org (from org_devices)
  orgUsers: OrgUser[]
}

// ---------------------------------------------------------------------------
// Row for an already-mapped device
// ---------------------------------------------------------------------------
function MappedDeviceRow({
  device,
  orgUsers,
  projectId,
  onChanged,
  onRemoved,
}: {
  device: MappedDevice
  orgUsers: OrgUser[]
  projectId: string
  onChanged: () => void
  onRemoved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [userId, setUserId] = useState(device.userId ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  function startEdit() {
    setUserId(device.userId ?? '')
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setError('')
    setConfirmDelete(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceAccount: device.deviceAccount, userId: userId || null }),
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

  async function handleRemove() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/devices/${device.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to remove')
        setDeleting(false)
      } else {
        onRemoved()
      }
    } catch {
      setError('Network error')
      setDeleting(false)
    }
  }

  if (!editing) {
    return (
      <tr className="hover:bg-[#F9FAFB] transition-colors group">
        <td className="px-6 py-3">
          <p className="font-mono text-sm text-[#111827]">{device.deviceAccount}</p>
        </td>
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
        <td className="px-6 py-3 text-right">
          <button
            onClick={startEdit}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="bg-[#FFFBEB] border-b border-[#E5E7EB]">
      <td colSpan={3} className="px-6 py-4">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
            Editing — <span className="font-mono">{device.deviceAccount}</span>
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#6B7280]">Camera User</span>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
              >
                <option value="">— None —</option>
                {orgUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                ))}
              </select>
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
              onClick={handleRemove}
              disabled={deleting}
              className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                confirmDelete
                  ? 'bg-[#EF4444] text-white hover:bg-red-600'
                  : 'text-[#EF4444] hover:bg-red-50'
              }`}
            >
              <Trash2 size={13} />
              {confirmDelete ? 'Confirm remove' : 'Remove device'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Add device row (shown at the bottom of the table)
// ---------------------------------------------------------------------------
function AddDeviceRow({
  projectId,
  orgDevices,
  mappedDevices,
  orgUsers,
  onAdded,
}: {
  projectId: string
  orgDevices: OrgDevice[]
  mappedDevices: MappedDevice[]
  orgUsers: OrgUser[]
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [deviceAccount, setDeviceAccount] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  // Only show org devices not already mapped to this project
  const available = useMemo(
    () => orgDevices.filter((d) => !mappedDevices.some((m) => m.deviceAccount === d.deviceAccount)),
    [orgDevices, mappedDevices],
  )

  async function handleAdd() {
    if (!deviceAccount) return
    setLoading(true)
    setError('')
    setWarning('')
    try {
      const res = await fetch(`/api/projects/${projectId}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceAccount, userId: userId || null }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to map device')
      } else {
        const d = await res.json()
        if (d.reassigned) setWarning(`Device moved from "${d.previousProject}" to this project.`)
        setDeviceAccount('')
        setUserId('')
        setOpen(false)
        onAdded()
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (available.length === 0 && !open) return null

  if (!open) {
    return (
      <tr>
        <td colSpan={3} className="px-6 py-3 border-t border-[#E5E7EB]">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <Plus size={14} />
            Add device
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="bg-[#F9FAFB] border-t border-[#E5E7EB]">
      <td colSpan={3} className="px-6 py-4">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Add device to project</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#6B7280]">Device</span>
              <select
                value={deviceAccount}
                onChange={(e) => setDeviceAccount(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
                autoFocus
              >
                <option value="">— Select device —</option>
                {available.map((d) => (
                  <option key={d.deviceAccount} value={d.deviceAccount}>
                    {d.label ? `${d.deviceAccount} — ${d.label}` : d.deviceAccount}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#6B7280]">Camera User</span>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={!deviceAccount}
                className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966] disabled:opacity-50"
              >
                <option value="">— None —</option>
                {orgUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                ))}
              </select>
            </label>
          </div>
          {warning && <p className="text-xs text-amber-600">{warning}</p>}
          {error && <p className="text-xs text-[#EF4444]">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={!deviceAccount || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] disabled:opacity-50 transition-colors"
            >
              <Plus size={13} />
              {loading ? 'Adding…' : 'Add device'}
            </button>
            <button
              onClick={() => { setOpen(false); setError(''); setWarning('') }}
              className="px-3 py-1.5 text-sm text-[#6B7280] hover:text-[#111827] rounded-lg hover:bg-[#F3F4F6] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export function ProjectDevicesPanel({ projectId, mappedDevices: initial, orgDevices, orgUsers }: Props) {
  const router = useRouter()
  const [mappedDevices, setMappedDevices] = useState(initial)

  function refresh() {
    router.refresh()
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[#E5E7EB]">
          <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Device Account</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Camera User</th>
          <th className="px-6 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y divide-[#E5E7EB]">
        {mappedDevices.length === 0 && (
          <tr>
            <td colSpan={3} className="px-6 py-8 text-center text-sm text-[#6B7280]">
              No devices mapped yet.
            </td>
          </tr>
        )}
        {mappedDevices.map((d) => (
          <MappedDeviceRow
            key={d.id}
            device={d}
            orgUsers={orgUsers}
            projectId={projectId}
            onChanged={refresh}
            onRemoved={refresh}
          />
        ))}
        <AddDeviceRow
          projectId={projectId}
          orgDevices={orgDevices}
          mappedDevices={mappedDevices}
          orgUsers={orgUsers}
          onAdded={refresh}
        />
      </tbody>
    </table>
  )
}
