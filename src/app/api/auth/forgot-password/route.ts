/**
 * POST /api/auth/forgot-password
 *
 * Accepts an email address and, if a matching user exists, creates a
 * password-reset token (expires in 15 minutes) and sends a reset link.
 *
 * Always returns 200 regardless of whether the email exists — prevents user enumeration.
 */

import { apiError } from '@/lib/api-helpers'
import { limits } from '@/lib/rate-limit'
import { queryOne, query } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendPasswordResetEmail } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'

const TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(req: NextRequest) {
  const limited = limits.passwordReset(req)
  if (limited) return limited

  let email: string
  try {
    const body = await req.json()
    email = (body?.email ?? '').toString().trim().toLowerCase()
  } catch {
    return apiError.badRequest('Invalid request body')
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiError.badRequest('A valid email address is required')
  }

  const user = await queryOne<{ id: string; name: string }>(
    'SELECT id, name FROM users WHERE email = $1',
    [email],
  )

  if (user) {
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt],
    )

    const resetUrl = `${process.env.APP_URL}/reset-password?token=${rawToken}`

    logger.info({ userId: user.id, resetUrl }, 'password reset link generated')
    await sendPasswordResetEmail(email, resetUrl).catch((err) => {
      logger.error({ userId: user.id, err }, 'failed to send password reset email')
    })
  }

  // Always 200 — do not reveal whether the email exists
  return NextResponse.json({
    message: 'If an account exists for that email, a reset link has been sent.',
  })
}
