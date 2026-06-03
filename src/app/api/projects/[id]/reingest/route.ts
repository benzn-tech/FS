import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { publishEvent } from '@/lib/eventbridge'
import { apiError } from '@/lib/api-helpers'

// POST /api/projects/[id]/reingest
// Super-admin only. Publishes a retry-requested event to EventBridge, which
// causes ingest_video Lambda to search RealPTT for the given file_name and
// re-download it. Use for recordings that never made it into the DB.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()
  if (session.user.role !== 'super_admin') return apiError.forbidden()

  const project = await queryOne<{ id: string }>(
    'SELECT id FROM projects WHERE id = $1',
    [projectId],
  )
  if (!project) return apiError.notFound('Project not found')

  const body = await req.json().catch(() => null)
  const realpttId: string | undefined = body?.realpttId?.trim()
  if (!realpttId) return apiError.badRequest('realpttId is required')

  // Validate format matches RealPTT file_name pattern YYYY-MM-DD-HH-MM-SS
  if (!/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(realpttId)) {
    return apiError.badRequest('realpttId must match YYYY-MM-DD-HH-MM-SS format')
  }

  // Use snake_case key to match what ingest_video.py reads from event detail
  await publishEvent('retry-requested', { realptt_id: realpttId })

  return NextResponse.json({ ok: true, message: `Re-ingest triggered for ${realpttId}` })
}
