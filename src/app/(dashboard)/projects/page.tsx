export const dynamic = 'force-dynamic'

import { type Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { FolderOpen, MapPin, BarChart2 } from 'lucide-react'
import Image from 'next/image'
import { CreateProjectForm } from './CreateProjectForm'

export const metadata: Metadata = { title: 'Projects' }

export default async function ProjectsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role, orgId, id: userId } = session.user

  type ProjectRow = { id: string; org_id: string; org_name: string; name: string; address: string | null; status: string; session_count: string; device_count: string; member_count: string; thumbnail_url: string | null }

  // Fetch orgs for super_admin create form
  const orgs = role === 'super_admin'
    ? await query<{ id: string; name: string }>('SELECT id, name FROM organisations ORDER BY name ASC')
    : []

  let projects: ProjectRow[]

  if (role === 'super_admin') {
    projects = await query<ProjectRow>(
      `SELECT p.id, p.org_id, o.name AS org_name, p.name, p.address, p.status, p.thumbnail_url,
              COUNT(DISTINCT s.id)::text AS session_count,
              COUNT(DISTINCT pd.id)::text AS device_count,
              COUNT(DISTINCT pm.user_id)::text AS member_count
         FROM projects p
         JOIN organisations o ON o.id = p.org_id
         LEFT JOIN sessions s ON s.project_id = p.id
         LEFT JOIN project_devices pd ON pd.project_id = p.id
         LEFT JOIN project_members pm ON pm.project_id = p.id
        GROUP BY p.id, o.name
        ORDER BY p.created_at DESC`,
    )
  } else if (role === 'org_admin') {
    projects = await query<ProjectRow>(
      `SELECT p.id, p.org_id, o.name AS org_name, p.name, p.address, p.status, p.thumbnail_url,
              COUNT(DISTINCT s.id)::text AS session_count,
              COUNT(DISTINCT pd.id)::text AS device_count,
              COUNT(DISTINCT pm.user_id)::text AS member_count
         FROM projects p
         JOIN organisations o ON o.id = p.org_id
         LEFT JOIN sessions s ON s.project_id = p.id
         LEFT JOIN project_devices pd ON pd.project_id = p.id
         LEFT JOIN project_members pm ON pm.project_id = p.id
        WHERE p.org_id = $1
        GROUP BY p.id, o.name
        ORDER BY p.created_at DESC`,
      [orgId],
    )
  } else {
    projects = await query<ProjectRow>(
      `SELECT p.id, p.org_id, o.name AS org_name, p.name, p.address, p.status, p.thumbnail_url,
              COUNT(DISTINCT s.id)::text AS session_count,
              COUNT(DISTINCT pd.id)::text AS device_count,
              COUNT(DISTINCT all_pm.user_id)::text AS member_count
         FROM projects p
         JOIN organisations o ON o.id = p.org_id
         JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
         LEFT JOIN sessions s ON s.project_id = p.id
         LEFT JOIN project_devices pd ON pd.project_id = p.id
         LEFT JOIN project_members all_pm ON all_pm.project_id = p.id
        WHERE p.org_id = $2
        GROUP BY p.id, o.name
        ORDER BY p.created_at DESC`,
      [userId, orgId],
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Projects</h1>
          <p className="text-sm text-[#6B7280] mt-1">Construction sites you have access to</p>
        </div>
        <div className="flex items-center gap-2">
          {role === 'org_admin' && orgId && (
            <Link
              href={`/organisations/${orgId}/insights`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
            >
              <BarChart2 size={14} />
              Org Insights
            </Link>
          )}
          {role === 'super_admin' && <CreateProjectForm orgs={orgs} />}
        </div>
      </div>

      {projects.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <FolderOpen className="mx-auto mb-3 text-[#D1D5DB]" size={40} />
            <p className="text-sm text-[#6B7280]">No projects found.</p>
            {role === 'super_admin' && (
              <p className="text-xs text-[#9CA3AF] mt-1">Create a project from the Admin panel to get started.</p>
            )}
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
                      {role === 'super_admin' && (
                        <p className="text-xs text-[#6B7280] mt-0.5 truncate">{project.org_name}</p>
                      )}
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
                    <p className="text-xs text-[#6B7280]">
                      {project.member_count} member{project.member_count !== '1' ? 's' : ''}
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
