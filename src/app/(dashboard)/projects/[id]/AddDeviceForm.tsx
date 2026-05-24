'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

interface OrgUser { id: string; name: string | null; email: string }

interface Props {
  projectId: string
  orgUsers: OrgUser[]
}

export function AddDeviceForm({ projectId, orgUsers }: Props) {
  const router = useRouter()
  const [deviceAccount, setDeviceAccount] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!deviceAccount.trim()) return
    setLoading(true)
    setError('')
    setWarning('')
    try {
      const res = await fetch(`/api/projects/${projectId}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceAccount: deviceAccount.trim(),
          userId: userId || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to map device')
      } else {
        const data = await res.json()
        if (data.reassigned) {
          setWarning(`Device moved from "${data.previousProject}" to this project.`)
        }
        setDeviceAccount('')
        setUserId('')
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={deviceAccount}
          onChange={(e) => setDeviceAccount(e.target.value)}
          placeholder="RealPTT account (e.g. Benl1)"
          className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966] font-mono"
        />
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
        >
          <option value="">No user</option>
          {orgUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!deviceAccount.trim() || loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          <Plus size={14} />
          Map Device
        </button>
      </div>
      {warning && <p className="text-xs text-amber-600">{warning}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  )
}
