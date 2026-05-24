'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Mail, ChevronDown, ChevronUp, Check } from 'lucide-react'

interface Props {
  projectId: string
  orgUsers: { id: string; email: string; name: string | null }[]
}

export function AddMemberForm({ projectId, orgUsers }: Props) {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Invite form state
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSent, setInviteSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to add member')
      } else {
        setUserId('')
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/members/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        setInviteError(data.error ?? 'Failed to send invite')
      } else {
        setInviteSent(true)
        setInviteEmail('')
        setInviteName('')
        setInviteRole('editor')
        router.refresh()
        setTimeout(() => setInviteSent(false), 4000)
      }
    } catch {
      setInviteError('Network error')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Existing user picker */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
        >
          <option value="">Select a user to add...</option>
          {orgUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ? `${u.name} (${u.email})` : u.email}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!userId || loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <UserPlus size={14} />
          Add
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </form>

      {/* Invite new user toggle */}
      <button
        type="button"
        onClick={() => setShowInvite((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#FF8F00] transition-colors self-start"
      >
        <Mail size={12} />
        Invite new user by email
        {showInvite ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {showInvite && (
        <form onSubmit={handleInvite} className="flex flex-col gap-2 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
          <p className="text-xs font-medium text-[#374151]">Invite new user</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Full name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              required
              className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
            />
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="editor_plus">Editor Plus</option>
              <option value="site_admin">Site Admin</option>
            </select>
            <button
              type="submit"
              disabled={inviteLoading || !inviteEmail || !inviteName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] disabled:opacity-50 transition-colors"
            >
              {inviteSent ? <Check size={14} className="text-green-600" /> : <Mail size={14} />}
              {inviteSent ? 'Invited!' : inviteLoading ? 'Sending…' : 'Send invite'}
            </button>
          </div>
          {inviteError && <p className="text-xs text-red-500">{inviteError}</p>}
          {inviteSent && <p className="text-xs text-green-600">Invite email sent to {inviteEmail}</p>}
        </form>
      )}
    </div>
  )
}
