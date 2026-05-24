'use client'

import { useState } from 'react'

interface Props {
  userId: string
  currentOrgId: string
  orgs: { id: string; name: string }[]
}

export function OrgSelect({ userId, currentOrgId, orgs }: Props) {
  const [orgId, setOrgId] = useState(currentOrgId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newOrgId = e.target.value
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: newOrgId }),
      })
      if (res.ok) {
        setOrgId(newOrgId)
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to update organisation')
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
        value={orgId}
        onChange={handleChange}
        disabled={saving}
        className="text-xs px-2 py-1 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  )
}
