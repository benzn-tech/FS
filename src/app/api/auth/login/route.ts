import { NextRequest, NextResponse } from 'next/server'
import { signInWithCredentials } from '@/lib/auth'
import { limits } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const limited = limits.auth(req)
  if (limited) return limited

  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const error = await signInWithCredentials(email, password)
  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
