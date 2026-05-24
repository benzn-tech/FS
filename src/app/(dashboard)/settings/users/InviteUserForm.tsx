'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { type Role } from '@/types'

interface Org { id: string; name: string }

interface Props {
  assignableRoles: Role[]
  orgs: Org[]
  defaultOrgId: string
}

const ROLE_LABELS: Record<string, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  editor_plus: 'Editor+',
  site_admin: 'Site Admin',
  org_admin: 'Org Admin',
}

export function InviteUserForm({ assignableRoles, orgs, defaultOrgId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>(assignableRoles[0] ?? 'viewer')
  const [orgId, setOrgId] = useState(defaultOrgId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          orgId,
          role,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to invite user')
      } else {
        setSuccess(`Invite sent to ${email.trim()}. The link expires in 24 hours.`)
        setName('')
        setEmail('')
        setRole(assignableRoles[0] ?? 'viewer')
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
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] transition-colors"
      >
        <UserPlus size={15} />
        Invite User
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-sm min-w-[320px]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#111827]">Add User</p>
        <button type="button" onClick={() => { setOpen(false); setError(''); setSuccess('') }} className="text-[#6B7280] hover:text-[#111827]">
          <X size={14} />
        </button>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name *"
        required
        className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address *"
        required
        autoFocus
        className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
      />
      <div className="flex gap-2">
        {orgs.length > 1 && (
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
          >
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
        >
          {assignableRoles.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {success && <p className="text-xs text-green-600">{success}</p>}

      <p className="text-xs text-[#9CA3AF]">An invite link will be emailed to the user. The link expires in 24 hours.</p>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); setSuccess('') }}
          className="px-3 py-1.5 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!email.trim() || loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating…' : 'Create Account'}
        </button>
      </div>
    </form>
  )
}
