import { NextRequest, NextResponse } from 'next/server'
import { sendContactEmail } from '@/lib/email'
import { logError } from '@/lib/api-helpers'
import { limits } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const limited = limits.email(req)
  if (limited) return limited

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { firstName, lastName, email, company, topic, message } = body

  if (!firstName || !lastName || !email || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  try {
    await sendContactEmail({ firstName, lastName, email, company, topic, message })
  } catch (err) {
    logError('/api/contact', err, { email })
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
