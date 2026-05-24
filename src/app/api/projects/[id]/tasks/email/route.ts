import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { verifyProjectAccess } from '@/lib/reports'
import { sendTasksEmail } from '@/lib/email'

// POST /api/projects/[id]/tasks/email
// Body: { date: 'YYYY-MM-DD' }
// Emails the logged-in user their action item list for the given date.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()

  const { role, orgId, id: userId, email: userEmail } = session.user
  if (!userEmail) return apiError.badRequest('No email address on account')

  const body = await req.json().catch(() => ({}))
  const { date } = body as { date?: string }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError.badRequest('date required (YYYY-MM-DD)')

  const project = await verifyProjectAccess(projectId, role, orgId, userId)
  if (!project) return apiError.notFound('Project not found')

  const tasks = await query<{
    text: string; priority: string; done: boolean
    tag: string | null; assignee_name: string | null
  }>(
    `SELECT pt.text, pt.priority, pt.done, pt.tag, u.name AS assignee_name
       FROM project_tasks pt
       LEFT JOIN users u ON u.id = pt.assignee_id
      WHERE pt.project_id = $1 AND pt.user_id = $2 AND pt.date = $3::date
      ORDER BY pt.created_at ASC`,
    [projectId, userId, date],
  )

  if (tasks.length === 0) return apiError.badRequest('No action items for this date')

  const projectRow = await queryOne<{ name: string }>('SELECT name FROM projects WHERE id = $1', [projectId])

  await sendTasksEmail(userEmail, projectRow?.name ?? project.name, date, tasks)

  return NextResponse.json({ ok: true, sentTo: userEmail })
}
