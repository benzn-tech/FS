import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { apiError, hasMinRole, logError } from '@/lib/api-helpers'
import { sendInviteEmail } from '@/lib/email'
import { randomBytes, createHash } from 'crypto'
import { limits } from '@/lib/rate-limit'

const INVITE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// POST /api/users/[id]/resend-invite
// Invalidates old tokens, generates a new 1-hour invite link, resends email
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = limits.email(_req)
  if (limited) return limited

  const { id: userId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()
  if (!hasMinRole(session.user.role, 'site_admin')) return apiError.forbidden()

  const user = await queryOne<{ id: string; email: string; name: string | null; org_id: string }>(
    'SELECT id, email, name, org_id FROM users WHERE id = $1',
    [userId],
  )
  if (!user) return apiError.notFound('User not found')

  // Only allow resend within same org unless super_admin
  if (user.org_id !== session.user.orgId && session.user.role !== 'super_admin') {
    return apiError.forbidden()
  }

  // Invalidate any existing unused tokens for this user
  await query(
    `UPDATE password_reset_tokens SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  )

  // Generate new 1-hour token
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  )

  const inviteLink = `${process.env.APP_URL}/reset-password?token=${rawToken}`

  try {
    await sendInviteEmail(user.email, user.name ?? user.email, inviteLink)
  } catch (err) {
    logError('/api/users/[id]/resend-invite', err, { email: user.email })
    return apiError.serverError('Failed to send invite email')
  }

  return NextResponse.json({ ok: true })
}
