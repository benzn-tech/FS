import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { verifyProjectAccess, fetchDayTranscript, invokeBedrockText, parseBedrockJson } from '@/lib/reports'
import { hasMinRole } from '@/lib/roles'

interface AiTask {
  text: string
  priority: 'high' | 'medium' | 'low'
  tag?: string
}

// GET /api/projects/[id]/tasks?date=YYYY-MM-DD[&assignee=me]
// Returns shared project tasks for this date. If none exist, AI-generates them (once per project+date).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()

  const { role, orgId, id: userId } = session.user
  const date = req.nextUrl.searchParams.get('date') ?? ''
  const assigneeFilter = req.nextUrl.searchParams.get('assignee') // 'me' or null

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError.badRequest('date required (YYYY-MM-DD)')

  const project = await verifyProjectAccess(projectId, role, orgId, userId)
  if (!project) return apiError.notFound('Project not found')

  // Return saved tasks (project-shared, no user_id filter)
  const filterClause = assigneeFilter === 'me' ? 'AND pt.assignee_id = $3' : ''
  const filterValues: unknown[] = assigneeFilter === 'me'
    ? [projectId, date, userId]
    : [projectId, date]

  const existing = await query<{
    id: string; text: string; priority: string; done: boolean
    tag: string | null; assignee_id: string | null; assignee_name: string | null
    created_by: string | null
  }>(
    `SELECT pt.id, pt.text, pt.priority, pt.done, pt.tag,
            pt.assignee_id, u.name AS assignee_name, pt.created_by
       FROM project_tasks pt
       LEFT JOIN users u ON u.id = pt.assignee_id
      WHERE pt.project_id = $1 AND pt.date = $2::date ${filterClause}
      ORDER BY pt.created_at ASC`,
    filterValues,
  )

  if (existing.length > 0) {
    return NextResponse.json({ tasks: existing, date })
  }

  // No tasks yet and no filter applied — AI-generate once for this project+date
  if (assigneeFilter) return NextResponse.json({ tasks: [], date })

  const { transcriptText, hasContent } = await fetchDayTranscript(projectId, date)
  if (!hasContent) return NextResponse.json({ tasks: [], date })

  const prompt = `You are a construction site assistant. Extract action items from these site transcripts.
Return ONLY valid JSON with no extra text:
{ "tasks": [{ "text": "...", "priority": "high", "tag": "Safety" }] }

Rules:
- Include tasks that are explicitly stated OR clearly implied by what is said (e.g. "that wall needs checking before the pour" → task: "Check wall before concrete pour")
- Do NOT invent topics, trades, or issues that have no basis in the transcript
- If transcripts are too vague or contain nothing actionable, return { "tasks": [] }
- Limit to 15 most important tasks
- priority: "high" for safety issues and urgent defects; "medium" for RFIs, inspections, follow-up instructions; "low" for general follow-ups
- tag: pick single best match from: Steel, Concrete, Electrical, Plumbing, Carpentry, Roofing, Safety, Earthworks, Painting, HVAC, Waterproofing, General — omit if unclear

TRANSCRIPTS:
${transcriptText}`

  try {
    const raw = await invokeBedrockText(prompt, 1024)
    const parsed = parseBedrockJson<{ tasks: AiTask[] }>(raw)
    const tasks: AiTask[] = (parsed.tasks ?? []).map((t) => ({
      text: String(t.text ?? '').trim(),
      priority: (['high', 'medium', 'low'] as const).includes(t.priority) ? t.priority : 'medium',
      tag: t.tag ? String(t.tag).trim() : undefined,
    })).filter((t) => t.text.length > 0).slice(0, 15)

    if (tasks.length === 0) return NextResponse.json({ tasks: [], date })

    const createdByIdx = 3 + tasks.length * 3
    const placeholders = tasks.map((_, i) => `($1, $2::date, $${3 + i * 3}, $${4 + i * 3}, $${5 + i * 3}, $${createdByIdx})`).join(', ')
    const values: unknown[] = [projectId, date]
    for (const t of tasks) { values.push(t.text, t.priority, t.tag ?? null) }
    values.push(userId) // created_by — always last param at $createdByIdx

    const saved = await query<{
      id: string; text: string; priority: string; done: boolean; tag: string | null; created_by: string | null
    }>(
      `INSERT INTO project_tasks (project_id, date, text, priority, tag, created_by)
       VALUES ${placeholders}
       RETURNING id, text, priority, done, tag, created_by`,
      values,
    )

    return NextResponse.json({
      tasks: saved.map((t) => ({ ...t, assignee_id: null, assignee_name: null })),
      date,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Bedrock task extraction failed:', msg)
    return NextResponse.json({ tasks: [], date, _error: msg })
  }
}

// POST /api/projects/[id]/tasks?date=YYYY-MM-DD — create a manual task
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()

  const { role, orgId, id: userId } = session.user
  const date = req.nextUrl.searchParams.get('date') ?? ''
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError.badRequest('date required (YYYY-MM-DD)')

  const project = await verifyProjectAccess(projectId, role, orgId, userId)
  if (!project) return apiError.notFound('Project not found')

  const body = await req.json().catch(() => ({}))
  const text = String(body.text ?? '').trim()
  const priority = (['high', 'medium', 'low'] as const).includes(body.priority) ? body.priority : 'medium'
  const tag = body.tag ? String(body.tag).trim() : null
  const assigneeId = body.assigneeId ? String(body.assigneeId) : null
  if (!text) return apiError.badRequest('text required')

  // Verify assignee is a member of the project if provided
  if (assigneeId) {
    const member = await queryOne(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, assigneeId],
    )
    if (!member) return apiError.badRequest('Assignee is not a project member')
  }

  const task = await queryOne<{
    id: string; text: string; priority: string; done: boolean; tag: string | null
    assignee_id: string | null; created_by: string | null
  }>(
    `INSERT INTO project_tasks (project_id, date, text, priority, tag, assignee_id, created_by)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7)
     RETURNING id, text, priority, done, tag, assignee_id, created_by`,
    [projectId, date, text, priority, tag, assigneeId, userId],
  )

  // Fetch assignee name if set
  let assigneeName: string | null = null
  if (task?.assignee_id) {
    const u = await queryOne<{ name: string | null }>('SELECT name FROM users WHERE id = $1', [task.assignee_id])
    assigneeName = u?.name ?? null
  }

  return NextResponse.json({ task: { ...task, assignee_name: assigneeName } })
}

// PATCH — update done, priority, tag, or assignee_id on a task
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()

  const { role, orgId, id: userId } = session.user

  // Verify project access
  const project = await verifyProjectAccess(projectId, role, orgId, userId)
  if (!project) return apiError.notFound('Project not found')

  const body = await req.json().catch(() => ({}))
  const { taskId, done, priority, tag, assigneeId } = body as {
    taskId?: string
    done?: boolean
    priority?: string
    tag?: string | null
    assigneeId?: string | null
  }
  if (!taskId) return apiError.badRequest('taskId required')

  const updates: string[] = []
  const values: unknown[] = []
  let i = 1

  if (done !== undefined) { updates.push(`done = $${i++}`); values.push(done) }
  if (priority !== undefined) {
    if (!['high', 'medium', 'low'].includes(priority)) return apiError.badRequest('invalid priority')
    updates.push(`priority = $${i++}`); values.push(priority)
  }
  if (tag !== undefined) { updates.push(`tag = $${i++}`); values.push(tag ?? null) }
  if (assigneeId !== undefined) { updates.push(`assignee_id = $${i++}`); values.push(assigneeId ?? null) }

  if (updates.length === 0) return apiError.badRequest('nothing to update')

  // Any project member can update tasks; task just needs to belong to the project
  values.push(taskId, projectId)
  const updated = await queryOne<{ id: string }>(
    `UPDATE project_tasks SET ${updates.join(', ')}
     WHERE id = $${i++} AND project_id = $${i++}
     RETURNING id`,
    values,
  )
  if (!updated) return apiError.notFound('Task not found')

  return NextResponse.json({ ok: true })
}

// DELETE /api/projects/[id]/tasks?taskId=xxx
// Task creator or site_admin+ can delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()

  const { role, orgId, id: userId } = session.user

  const project = await verifyProjectAccess(projectId, role, orgId, userId)
  if (!project) return apiError.notFound('Project not found')

  const taskId = req.nextUrl.searchParams.get('taskId')
  if (!taskId) return apiError.badRequest('taskId required')

  const task = await queryOne<{ id: string; created_by: string | null }>(
    'SELECT id, created_by FROM project_tasks WHERE id = $1 AND project_id = $2',
    [taskId, projectId],
  )
  if (!task) return apiError.notFound('Task not found')

  // Must be creator or site_admin+
  const isAdmin = hasMinRole(role, 'site_admin')
  if (!isAdmin && task.created_by !== userId) return apiError.forbidden('Cannot delete another user\'s task')

  await queryOne('DELETE FROM project_tasks WHERE id = $1', [taskId])

  return NextResponse.json({ ok: true })
}
