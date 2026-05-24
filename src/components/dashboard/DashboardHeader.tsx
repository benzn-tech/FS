import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { Badge } from '@/components/ui/Badge'
import { LogoutButton } from '@/components/dashboard/LogoutButton'
import Link from 'next/link'

const roleLabelMap: Record<string, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  editor_plus: 'Editor+',
  site_admin: 'Site Admin',
  org_admin: 'Org Admin',
  super_admin: 'Super Admin',
}

interface DashboardHeaderProps {
  breadcrumb?: string
}

export async function DashboardHeader({ breadcrumb }: DashboardHeaderProps) {
  const session = process.env.NODE_ENV === 'development' ? null : await auth()
  const user = session?.user ?? (process.env.NODE_ENV === 'development'
    ? { name: 'Dev Admin', email: 'dev@local', role: 'super_admin' as const, orgId: null }
    : null)

  const orgName = user && 'orgId' in user && user.orgId
    ? (await queryOne<{ name: string }>('SELECT name FROM organisations WHERE id = $1', [user.orgId]))?.name ?? 'FieldSightAI'
    : 'FieldSightAI'

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-[#E5E7EB] flex-shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
        >
          {orgName}
        </Link>
        {breadcrumb && (
          <>
            <span className="text-[#E5E7EB]">/</span>
            <span className="text-sm font-medium text-[#111827]">{breadcrumb}</span>
          </>
        )}
      </div>

      {/* User info */}
      {user && (
        <div className="flex items-center gap-3">
          <Badge variant="info">{roleLabelMap[user.role] ?? user.role}</Badge>
          <span className="text-sm text-[#111827] font-medium hidden sm:block">
            {user.name ?? user.email}
          </span>
          <LogoutButton />
        </div>
      )}
    </header>
  )
}
