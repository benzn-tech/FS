import { withAuth, apiError } from '@/lib/api-helpers'
import { limits } from '@/lib/rate-limit'
import { queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'

let _lambda: LambdaClient | undefined
function getLambda(): LambdaClient {
  if (!_lambda) {
    _lambda = new LambdaClient({
      region: process.env.AWS_REGION ?? 'ap-southeast-2',
      credentials: process.env.APP_AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
          }
        : undefined,
    })
  }
  return _lambda
}

const LAMBDA_NAMES: Record<string, string> = {
  aconex:   'fieldsightai-export-to-aconex',
  safebase: 'fieldsightai-export-to-safebase',
}

// POST /api/sessions/[id]/export — invoke Aconex or Safebase export Lambda
export const POST = withAuth(
  async (req, session, { params }) => {
    const limited = limits.export(req)
    if (limited) return limited

    const id = (params as { id: string }).id
    const body = await req.json()
    const { platform } = body as { platform: 'aconex' | 'safebase' }

    if (!['aconex', 'safebase'].includes(platform)) {
      return apiError.badRequest('platform must be "aconex" or "safebase"')
    }

    // Validate session belongs to org and is in an exportable state
    const row = await queryOne<{ id: string; status: string; org_id: string }>(
      'SELECT id, status, org_id FROM sessions WHERE id = $1 AND org_id = $2',
      [id, session.user.orgId],
    )
    if (!row) return apiError.notFound('Session not found')
    if (!['READY', 'EXPORTED'].includes(row.status)) {
      return apiError.badRequest('Transcript must be finalised before export')
    }

    // Invoke the export Lambda synchronously (RequestResponse)
    const lambdaPayload = JSON.stringify({ session_id: id, org_id: session.user.orgId })
    const command = new InvokeCommand({
      FunctionName: LAMBDA_NAMES[platform],
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(lambdaPayload),
    })

    const result = await getLambda().send(command)

    if (result.FunctionError) {
      const errorPayload = result.Payload
        ? JSON.parse(Buffer.from(result.Payload).toString())
        : {}
      return apiError.serverError(errorPayload?.errorMessage ?? `${platform} export failed`)
    }

    return NextResponse.json({ ok: true, platform })
  },
  { minRole: 'editor' },
)
