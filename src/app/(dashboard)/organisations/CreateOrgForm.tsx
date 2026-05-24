'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

export function CreateOrgForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/organisations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create organisation')
      } else {
        setName('')
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
        New Organisation
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-sm min-w-[280px]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#111827]">New Organisation</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[#6B7280] hover:text-[#111827]">
          <X size={14} />
        </button>
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Organisation name *"
        required
        autoFocus
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
          {loading ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  )
}
