import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { queryOne } from '@/lib/db'
import { verifyProjectAccess, generateDailyReport } from '@/lib/reports'
import { sendReportEmail } from '@/lib/email'

// POST /api/projects/[id]/report/email
// Body: { date: 'YYYY-MM-DD', projectName?: string, recipientEmail?: string }
// Generates a daily report and emails it to the requesting user (or recipientEmail for super_admin).
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
  const { date, projectName, recipientEmail } = body as {
    date?: string
    projectName?: string
    recipientEmail?: string
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return apiError.badRequest('date required (YYYY-MM-DD)')
  }

  const project = await verifyProjectAccess(projectId, role, orgId, userId)
  if (!project) return apiError.notFound('Project not found')

  const coords = await queryOne<{ latitude: string | null; longitude: string | null }>(
    'SELECT latitude, longitude FROM projects WHERE id = $1',
    [projectId],
  )
  const geoCoords = coords?.latitude && coords?.longitude
    ? { latitude: parseFloat(coords.latitude), longitude: parseFloat(coords.longitude) }
    : null

  const to =
    recipientEmail && (role === 'super_admin' || role === 'org_admin')
      ? recipientEmail
      : userEmail

  try {
    const siteName = projectName ?? project.name
    const report = await generateDailyReport(projectId, date, siteName, geoCoords)

    if (report === null) {
      return apiError.badRequest('No transcripts available for this date')
    }

    await sendReportEmail(to, siteName, date, report)

    return NextResponse.json({ ok: true, sentTo: to })
  } catch (err) {
    console.error('Report email failed:', err)
    return apiError.serverError('Failed to send report email')
  }
}
