import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { queryOne } from '@/lib/db'
import { verifyProjectAccess, generateDailyReport } from '@/lib/reports'

// POST /api/projects/[id]/report
// Body: { date: 'YYYY-MM-DD', projectName: string }
// Fetches all transcripts for that day and generates an AI daily report via AWS Bedrock.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()

  const { role, orgId, id: userId } = session.user

  const body = await req.json().catch(() => ({}))
  const { date, projectName } = body as { date?: string; projectName?: string }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
    return apiError.badRequest('date required (YYYY-MM-DD)')
  }

  const project = await verifyProjectAccess(projectId, role, orgId, userId)
  if (!project) return apiError.notFound('Project not found')

  // Fetch coordinates for weather lookup
  const coords = await queryOne<{ latitude: string | null; longitude: string | null }>(
    'SELECT latitude, longitude FROM projects WHERE id = $1',
    [projectId],
  )
  const geoCoords = coords?.latitude && coords?.longitude
    ? { latitude: parseFloat(coords.latitude), longitude: parseFloat(coords.longitude) }
    : null

  try {
    const siteName = projectName ?? project.name
    const report = await generateDailyReport(projectId, date, siteName, geoCoords)

    if (report === null) {
      return NextResponse.json({ report: null, message: 'No transcripts available for this date.' })
    }

    return NextResponse.json({ report, date, projectName: siteName })
  } catch (err) {
    console.error('Bedrock report generation failed:', err)
    return apiError.serverError('Failed to generate report')
  }
}
