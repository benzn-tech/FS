export const dynamic = 'force-dynamic'

import { type Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { hasMinRole } from '@/lib/api-helpers'
import Link from 'next/link'
import { ArrowLeft, BarChart2 } from 'lucide-react'
import { InsightsDashboard } from './InsightsDashboard'

export const metadata: Metadata = { title: 'Project Insights' }

export default async function ProjectInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role, orgId, id: userId } = session.user

  const project = await queryOne<{ id: string; org_id: string; name: string }>(
    'SELECT id, org_id, name FROM projects WHERE id = $1',
    [projectId],
  )
  if (!project) notFound()

  const isSuperAdmin = role === 'super_admin'
  const isOrgAdmin = role === 'org_admin'
  const inSameOrg = project.org_id === orgId

  if (!isSuperAdmin) {
    if (!inSameOrg) notFound()
    if (!isOrgAdmin) {
      const membership = await queryOne(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, userId],
      )
      if (!membership) notFound()
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111827] mb-3"
        >
          <ArrowLeft size={14} />
          Back to {project.name}
        </Link>
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-[#6B7280]" />
          <h1 className="text-xl font-bold text-[#111827]">Project Insights</h1>
        </div>
        <p className="text-sm text-[#6B7280] mt-1">{project.name}</p>
      </div>

      <InsightsDashboard projectId={projectId} />
    </div>
  )
}
