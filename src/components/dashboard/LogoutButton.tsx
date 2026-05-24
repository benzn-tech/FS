'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="p-1.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB] rounded-md transition-colors"
      title="Sign out"
    >
      <LogOut className="w-4 h-4" />
    </button>
  )
}
