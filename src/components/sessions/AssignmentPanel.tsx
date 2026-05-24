'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, User, Check } from 'lucide-react'

interface Project { id: string; name: string }
interface OrgUser { id: string; name: string | null; email: string }

interface Props {
  sessionId: string
  currentProjectId: string | null
  currentUserId: string | null
  projects: Project[]
  users: OrgUser[]
}

export function AssignmentPanel({ sessionId, currentProjectId, currentUserId, projects, users }: Props) {
  const router = useRouter()
  const [projectId, setProjectId] = useState(currentProjectId ?? '')
  const [userId, setUserId] = useState(currentUserId ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const isDirty = projectId !== (currentProjectId ?? '') || userId !== (currentUserId ?? '')

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId || null,
          userId: userId || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save')
      } else {
        setSaved(true)
        router.refresh()
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-[#111827]">Assignment</h2>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[#6B7280] flex items-center gap-1">
            <FolderOpen size={11} /> Project
          </span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
          >
            <option value="">— Unassigned —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[#6B7280] flex items-center gap-1">
            <User size={11} /> User
          </span>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
          >
            <option value="">— Unassigned —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-xs text-[#EF4444]">{error}</p>}

      <button
        onClick={handleSave}
        disabled={!isDirty || saving}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#FFD966] text-[#111827] hover:bg-[#FFC107]"
      >
        {saved ? (
          <><Check size={13} /> Saved</>
        ) : saving ? (
          'Saving...'
        ) : (
          'Save assignment'
        )}
      </button>
    </div>
  )
}
