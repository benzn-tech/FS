export const dynamic = 'force-dynamic'

import { type Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { hasMinRole } from '@/lib/api-helpers'
import Link from 'next/link'
import { ArrowLeft, BarChart2 } from 'lucide-react'
import { OrgInsightsDashboard } from './OrgInsightsDashboard'

export const metadata: Metadata = { title: 'Organisation Insights' }

export default async function OrgInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orgId } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role, orgId: userOrgId } = session.user

  if (!hasMinRole(role, 'org_admin')) redirect('/projects')

  // org_admin can only see their own org
  if (role === 'org_admin' && userOrgId !== orgId) notFound()

  const org = await queryOne<{ id: string; name: string }>(
    'SELECT id, name FROM organisations WHERE id = $1',
    [orgId],
  )
  if (!org) notFound()

  const backHref = role === 'super_admin' ? `/organisations/${orgId}` : '/projects'
  const backLabel = role === 'super_admin' ? org.name : 'My Projects'

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111827] mb-3"
        >
          <ArrowLeft size={14} />
          Back to {backLabel}
        </Link>
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-[#6B7280]" />
          <h1 className="text-xl font-bold text-[#111827]">Organisation Insights</h1>
        </div>
        <p className="text-sm text-[#6B7280] mt-1">{org.name}</p>
      </div>

      <OrgInsightsDashboard orgId={orgId} />
    </div>
  )
}
