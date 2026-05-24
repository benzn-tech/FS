'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

interface Org { id: string; name: string }

export function CreateProjectForm({ orgs }: { orgs: Org[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? '')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !orgId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, name: name.trim(), address: address.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create project')
      } else {
        setName('')
        setAddress('')
        setOpen(false)
        router.refresh()
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] transition-colors"
      >
        <Plus size={14} />
        New Project
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#111827]">New Project</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[#6B7280] hover:text-[#111827]">
          <X size={14} />
        </button>
      </div>
      {orgs.length > 1 && (
        <select
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
        >
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name *"
        required
        className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
      />
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Site address (optional)"
        className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating…' : 'Create Project'}
        </button>
      </div>
    </form>
  )
}
