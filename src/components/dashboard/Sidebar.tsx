'use client'

import { cn } from '@/lib/utils'
import { type Role } from '@/types'
import { hasMinRole } from '@/lib/roles'
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  Users,
  Shield,
  Building2,
  Cpu,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  minRole?: Role
  excludeRoles?: Role[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, minRole: 'super_admin' },
  { label: 'Projects', href: '/projects', icon: FolderKanban, excludeRoles: ['super_admin'] },
  { label: 'Organisations', href: '/organisations', icon: Building2, minRole: 'super_admin' },
  { label: 'Devices', href: '/devices', icon: Cpu, minRole: 'super_admin' },
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Users', href: '/settings/users', icon: Users, minRole: 'site_admin' },
  { label: 'Admin', href: '/admin', icon: Shield, minRole: 'super_admin' },
]


interface SidebarProps {
  userRole: Role
  userName?: string
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = navItems.filter(
    (item) =>
      (!item.minRole || hasMinRole(userRole, item.minRole)) &&
      (!item.excludeRoles || !item.excludeRoles.includes(userRole)),
  )

  return (
    <aside
      className={cn(
        'flex flex-col bg-[#111827] text-white transition-all duration-200 flex-shrink-0 overflow-y-auto',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/10 flex-shrink-0">
        {collapsed ? (
          <Link href={hasMinRole(userRole, 'super_admin') ? '/dashboard' : '/projects'} className="mx-auto">
            <Image src="/logo.png" alt="FieldSightAI logo" width={28} height={28} className="object-contain" />
          </Link>
        ) : (
          <Link href={hasMinRole(userRole, 'super_admin') ? '/dashboard' : '/projects'} className="flex items-center gap-2 text-lg font-bold tracking-tight truncate">
            <Image src="/logo.png" alt="FieldSightAI logo" width={28} height={28} className="object-contain flex-shrink-0" />
            <span>Field<span className="text-[#FFD966]">Sight</span>AI™</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors',
            collapsed ? 'mx-auto' : 'ml-auto',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-[#FFD966] text-[#111827]'
                  : 'text-gray-400 hover:text-white hover:bg-white/10',
                collapsed && 'justify-center px-2',
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      {!collapsed && userName && (
        <div className="px-4 py-4 border-t border-white/10 mt-auto">
          <p className="text-xs text-gray-400 truncate">{userName}</p>
          <p className="text-xs text-[#FFD966] font-medium mt-0.5 capitalize">
            {userRole.replace('_', ' ')}
          </p>
        </div>
      )}
    </aside>
  )
}
