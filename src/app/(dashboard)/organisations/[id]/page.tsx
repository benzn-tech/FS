export const dynamic = 'force-dynamic'

import { type Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { query, queryOne } from '@/lib/db'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { ArrowLeft, MapPin, FolderOpen, BarChart2 } from 'lucide-react'
import Image from 'next/image'
import { CreateProjectForm } from '../../projects/CreateProjectForm'
import { OrgNameEditor } from './OrgNameEditor'

export const metadata: Metadata = { title: 'Organisation' }

export default async function OrganisationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orgId } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role } = session.user

  if (role !== 'super_admin') redirect('/projects')

  const org = await queryOne<{ id: string; name: string }>(
    'SELECT id, name FROM organisations WHERE id = $1',
    [orgId],
  )

  if (!org) notFound()

  type ProjectRow = {
    id: string
    name: string
    address: string | null
    status: string
    session_count: string
    device_count: string
    thumbnail_url: string | null
  }

  const projects = await query<ProjectRow>(
    `SELECT p.id, p.name, p.address, p.status, p.thumbnail_url,
            COUNT(DISTINCT s.id)::text AS session_count,
            COUNT(DISTINCT pd.id)::text AS device_count
       FROM projects p
       LEFT JOIN sessions s ON s.project_id = p.id
       LEFT JOIN project_devices pd ON pd.project_id = p.id
      WHERE p.org_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC`,
    [orgId],
  )

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div>
        <Link href="/organisations" className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111827] mb-3">
          <ArrowLeft size={14} />
          All Organisations
        </Link>
        <div className="flex items-start justify-between gap-4">
          <OrgNameEditor orgId={org.id} initialName={org.name} />
          <div className="flex items-center gap-2">
            <Link
              href={`/organisations/${org.id}/insights`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
            >
              <BarChart2 size={14} />
              Insights
            </Link>
            <CreateProjectForm orgs={[{ id: org.id, name: org.name }]} />
          </div>
        </div>
      </div>

      {/* Projects grid */}
      {projects.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <FolderOpen className="mx-auto mb-3 text-[#D1D5DB]" size={40} />
            <p className="text-sm text-[#6B7280]">No projects yet.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card
                padding="md"
                className="hover:border-[#FFD966] hover:shadow-md transition-all duration-150 cursor-pointer h-full"
              >
                <div className="flex flex-col gap-3 h-full">
                  {project.thumbnail_url && (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-[#F3F4F6]">
                      <Image src={project.thumbnail_url} alt={project.name} fill className="object-cover" unoptimized />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#111827] truncate">{project.name}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      project.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {project.status}
                    </span>
                  </div>

                  {project.address && (
                    <div className="flex items-start gap-1.5 text-xs text-[#6B7280]">
                      <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{project.address}</span>
                    </div>
                  )}

                  <div className="mt-auto pt-2 border-t border-[#E5E7EB] flex gap-4">
                    <p className="text-xs text-[#6B7280]">
                      {project.session_count} recording{project.session_count !== '1' ? 's' : ''}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {project.device_count} device{project.device_count !== '1' ? 's' : ''}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
