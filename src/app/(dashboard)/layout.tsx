import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { type ReactNode } from 'react'

const DEV_BYPASS = process.env.NODE_ENV === 'development'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = DEV_BYPASS ? null : await auth()

  if (!DEV_BYPASS && !session?.user) {
    redirect('/login')
  }

  const userRole = session?.user?.role ?? 'super_admin'
  const userName = session?.user?.name ?? session?.user?.email ?? 'Dev User'

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden">
      <Sidebar userRole={userRole} userName={userName} />
      <div className="flex flex-col flex-1 min-w-0">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
