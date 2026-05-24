import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { limits } from '@/lib/rate-limit'
import { publishEvent } from '@/lib/eventbridge'
import { logger } from '@/lib/logger'

function verifyHmac(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex')
  try {
    return timingSafeEqual(
      Buffer.from(`sha256=${expected}`),
      Buffer.from(signature),
    )
  } catch {
    return false
  }
}

// POST /api/webhooks/realptt — receive video-uploaded event from RealPTT
export async function POST(req: NextRequest) {
  const limited = limits.webhook(req)
  if (limited) return limited

  const signature = req.headers.get('x-realptt-signature') ?? ''
  const secret = process.env.REALPTT_WEBHOOK_SECRET

  if (!secret) {
    logger.error('REALPTT_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const rawBody = await req.text()

  if (!verifyHmac(rawBody, signature, secret)) {
    logger.warn({ signature }, 'realptt webhook rejected — invalid HMAC signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  logger.info({ event: payload.event, recordingId: payload.recording_id }, 'realptt webhook received')

  await publishEvent('realptt-video-uploaded', payload)

  return NextResponse.json({ ok: true })
}
