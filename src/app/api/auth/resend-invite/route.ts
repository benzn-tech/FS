import { NextRequest, NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'
import { apiError, logError } from '@/lib/api-helpers'
import { sendInviteEmail } from '@/lib/email'
import { randomBytes, createHash } from 'crypto'
import { limits } from '@/lib/rate-limit'

const INVITE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// POST /api/auth/resend-invite
// Public endpoint — takes an email, finds the user, sends a fresh invite link.
// Rate limited. Only works for users who have never logged in (no active session).
export async function POST(req: NextRequest) {
  const limited = limits.auth(req)
  if (limited) return limited

  let email: string
  try {
    const body = await req.json()
    email = (body?.email ?? '').toString().trim().toLowerCase()
  } catch {
    return apiError.badRequest('Invalid request body')
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiError.badRequest('Valid email required')
  }

  // Always return success to avoid user enumeration
  const user = await queryOne<{ id: string; name: string | null }>(
    'SELECT id, name FROM users WHERE email = $1',
    [email],
  )

  if (user) {
    try {
      // Invalidate old tokens
      await query(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
        [user.id],
      )

      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt],
      )

      const inviteLink = `${process.env.APP_URL}/reset-password?token=${rawToken}`
      await sendInviteEmail(email, user.name ?? email, inviteLink)
    } catch (err) {
      logError('/api/auth/resend-invite', err, { email })
    }
  }

  return NextResponse.json({ ok: true })
}
