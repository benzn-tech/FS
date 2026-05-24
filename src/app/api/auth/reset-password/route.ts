/**
 * POST /api/auth/reset-password
 *
 * Validates a raw reset token, updates the user's password, and marks
 * the token as consumed.
 */

import { apiError } from '@/lib/api-helpers'
import { limits } from '@/lib/rate-limit'
import { queryOne, withTransaction } from '@/lib/db'
import { clearSession } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const limited = limits.passwordReset(req)
  if (limited) return limited

  let token: string, password: string
  try {
    const body = await req.json()
    token = (body?.token ?? '').toString().trim()
    password = (body?.password ?? '').toString()
  } catch {
    return apiError.badRequest('Invalid request body')
  }

  if (!token) return apiError.badRequest('Reset token is required')
  if (!password || password.length < 8) {
    return apiError.badRequest('Password must be at least 8 characters')
  }

  const tokenHash = createHash('sha256').update(token).digest('hex')

  const row = await queryOne<{
    id: string; user_id: string; expires_at: string; used_at: string | null
  }>(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash],
  )

  if (!row) return apiError.badRequest('Invalid or expired reset link')
  if (row.used_at) return apiError.badRequest('This reset link has already been used')
  if (new Date(row.expires_at) < new Date()) return apiError.badRequest('This reset link has expired')

  const passwordHash = await bcrypt.hash(password, 12)

  await withTransaction(async (client) => {
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, row.user_id])
    await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id])
  })

  // Clear any existing session so user must log in with new password
  await clearSession()

  return NextResponse.json({ message: 'Password updated successfully' })
}
