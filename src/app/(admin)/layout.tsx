import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { type ReactNode } from 'react'
import { LayoutGrid, FileText, Image, LogOut, ExternalLink } from 'lucide-react'

const adminNav = [
  { label: 'Overview', href: '/admin', icon: LayoutGrid },
  { label: 'Pages', href: '/admin/pages/landing', icon: FileText },
  { label: 'Media', href: '/admin/media', icon: Image },
]

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user || session.user.role !== 'super_admin') {
    redirect('/dashboard')
  }

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col bg-[#111827] text-white flex-shrink-0">
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b border-white/10">
          <span className="text-sm font-bold tracking-tight">
            Field<span className="text-[#FFD966]">Sight</span>AI
            <span className="ml-1.5 text-xs font-normal text-gray-400">CMS</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-0.5 p-3">
          {adminNav.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom links */}
        <div className="px-3 pb-4 flex flex-col gap-1 border-t border-white/10 pt-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ExternalLink size={16} />
            Back to App
          </Link>
          <Link
            href="/api/auth/signout"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="h-14 flex items-center px-6 bg-white border-b border-[#E5E7EB] flex-shrink-0">
          <p className="text-sm font-medium text-[#111827]">Super Admin CMS</p>
          <span className="ml-3 text-xs bg-[#FFFDE7] text-[#FF8F00] border border-[#FFD966]/40 px-2 py-0.5 rounded-full font-medium">
            super_admin
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
