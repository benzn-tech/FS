export const dynamic = 'force-dynamic'

import { type Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { CreateOrgForm } from './CreateOrgForm'

export const metadata: Metadata = { title: 'Organisations' }

export default async function OrganisationsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role } = session.user

  if (role !== 'super_admin') redirect('/projects')

  type OrgRow = {
    id: string
    name: string
    project_count: string
    session_count: string
  }

  const orgs = await query<OrgRow>(
    `SELECT o.id, o.name,
            COUNT(DISTINCT p.id)::text AS project_count,
            COUNT(DISTINCT s.id)::text AS session_count
       FROM organisations o
       LEFT JOIN projects p ON p.org_id = o.id
       LEFT JOIN sessions s ON s.project_id = p.id
      GROUP BY o.id
      ORDER BY o.name ASC`,
  )

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Organisations</h1>
          <p className="text-sm text-[#6B7280] mt-1">Manage client organisations and their projects</p>
        </div>
        <CreateOrgForm />
      </div>

      {orgs.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <Building2 className="mx-auto mb-3 text-[#D1D5DB]" size={40} />
            <p className="text-sm text-[#6B7280]">No organisations found.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <Link key={org.id} href={`/organisations/${org.id}`}>
              <Card
                padding="md"
                className="hover:border-[#FFD966] hover:shadow-md transition-all duration-150 cursor-pointer h-full"
              >
                <div className="flex flex-col gap-3 h-full">
                  <div className="flex items-start gap-2">
                    <Building2 size={16} className="text-[#6B7280] flex-shrink-0 mt-0.5" />
                    <p className="font-semibold text-[#111827] truncate">{org.name}</p>
                  </div>

                  <div className="mt-auto pt-2 border-t border-[#E5E7EB] flex gap-4">
                    <p className="text-xs text-[#6B7280]">
                      {org.project_count} project{org.project_count !== '1' ? 's' : ''}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {org.session_count} recording{org.session_count !== '1' ? 's' : ''}
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
