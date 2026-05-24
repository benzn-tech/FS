'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X } from 'lucide-react'

interface Props {
  orgId: string
  initialName: string
}

export function OrgNameEditor({ orgId, initialName }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!name.trim() || name.trim() === initialName) {
      setEditing(false)
      setName(initialName)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/organisations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save')
      } else {
        setEditing(false)
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    setName(initialName)
    setEditing(false)
    setError('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 group">
        <h1 className="text-2xl font-bold text-[#111827]">{initialName}</h1>
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded text-[#D1D5DB] hover:text-[#6B7280] opacity-0 group-hover:opacity-100 transition-all"
          title="Rename organisation"
        >
          <Pencil size={15} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="text-2xl font-bold text-[#111827] bg-transparent border-b-2 border-[#FFD966] focus:outline-none px-0 py-0.5 w-auto min-w-[200px]"
        />
        <button
          onClick={handleSave}
          disabled={loading || !name.trim()}
          className="p-1.5 rounded-lg text-white bg-[#111827] hover:bg-[#374151] disabled:opacity-50 transition-colors"
          title="Save"
        >
          <Check size={14} />
        </button>
        <button
          onClick={handleCancel}
          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
          title="Cancel"
        >
          <X size={14} />
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
