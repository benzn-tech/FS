'use client'

import { useState } from 'react'
import { type Role } from '@/types'

const ROLE_LABELS: Record<Role, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  editor_plus: 'Editor+',
  site_admin: 'Site Admin',
  org_admin: 'Org Admin',
  super_admin: 'Super Admin',
}

interface Props {
  userId: string
  currentRole: Role
  assignableRoles: Role[]
  disabled: boolean
}

export function RoleSelect({ userId, currentRole, assignableRoles, disabled }: Props) {
  const [role, setRole] = useState<Role>(currentRole)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as Role
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setRole(newRole)
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to update role')
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={role}
        onChange={handleChange}
        disabled={disabled || saving}
        className="text-xs px-2 py-1 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {assignableRoles.map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  )
}
