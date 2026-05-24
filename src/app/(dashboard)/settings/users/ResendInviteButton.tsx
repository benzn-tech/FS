'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'

export function ResendInviteButton({ userId }: { userId: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleClick() {
    setStatus('sending')
    try {
      const res = await fetch(`/api/users/${userId}/resend-invite`, { method: 'POST' })
      setStatus(res.ok ? 'sent' : 'error')
    } catch {
      setStatus('error')
    }
    setTimeout(() => setStatus('idle'), 3000)
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'sending'}
      title={status === 'sent' ? 'Invite sent!' : status === 'error' ? 'Failed to send' : 'Resend invite'}
      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${status === 'sent' ? 'text-green-600 bg-green-50' :
          status === 'error' ? 'text-red-500 bg-red-50' :
          'text-[#6B7280] hover:text-[#FF8F00] hover:bg-[#FFF8E7]'}`}
    >
      <Mail size={15} />
    </button>
  )
}
