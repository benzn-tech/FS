import { NextResponse } from 'next/server'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { apiError } from '@/lib/api-helpers'

function makeLambdaClient() {
  return new LambdaClient({
    region: process.env.AWS_REGION ?? 'ap-southeast-2',
    credentials: process.env.APP_AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
        }
      : undefined,
  })
}

// POST /api/sessions/[id]/trigger-transcription
// Super-admin only. Directly invokes the trigger-transcription Lambda for a
// session stuck at INGESTED (i.e. the S3 PUT event was missed).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()
  if (session.user.role !== 'super_admin') return apiError.forbidden()

  const row = await queryOne<{ id: string; status: string; video_s3_key: string }>(
    `SELECT id, status, video_s3_key FROM sessions WHERE id = $1`,
    [sessionId],
  )
  if (!row) return apiError.notFound('Session not found')
  if (row.status !== 'INGESTED') {
    return apiError.badRequest(`Session must be INGESTED to trigger transcription (current: ${row.status})`)
  }
  if (!row.video_s3_key) {
    return apiError.badRequest('Session has no S3 key — file may not have been downloaded')
  }

  const payload = {
    Records: [{
      s3: {
        bucket: { name: process.env.S3_VIDEOS_BUCKET ?? 'fsai-videos' },
        object: { key: row.video_s3_key },
      },
    }],
  }

  try {
    await makeLambdaClient().send(new InvokeCommand({
      FunctionName: 'fieldsightai-trigger-transcription',
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify(payload)),
    }))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[trigger-transcription] Lambda invoke failed:', msg)
    return NextResponse.json({ error: `Lambda invoke failed: ${msg}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: 'Transcription triggered' })
}
