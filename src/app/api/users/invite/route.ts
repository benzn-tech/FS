import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { apiError, hasMinRole, logError } from '@/lib/api-helpers'
import { sendInviteEmail } from '@/lib/email'
import { randomBytes, createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { type Role } from '@/types'
import { limits } from '@/lib/rate-limit'

const INVITE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// POST /api/users/invite
// Body: { email, name, role, orgId }
// Creates user + sends invite email with 24-hour reset link
export async function POST(req: NextRequest) {
  const limited = limits.email(req)
  if (limited) return limited

  const session = await auth()
  if (!session?.user) return apiError.unauthorized()
  if (!hasMinRole(session.user.role, 'site_admin')) return apiError.forbidden()

  const body = await req.json().catch(() => ({}))
  const { email, name, role: inviteRole, orgId } = body as {
    email?: string
    name?: string
    role?: string
    orgId?: string
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return apiError.badRequest('Valid email required')
  }
  if (!name || name.trim().length < 1) {
    return apiError.badRequest('Name required')
  }

  const allowedRoles: Role[] = ['viewer', 'editor', 'editor_plus', 'site_admin', 'org_admin', 'super_admin']
  const callerAllowedRoles: Role[] = session.user.role === 'super_admin'
    ? allowedRoles
    : session.user.role === 'org_admin'
      ? ['viewer', 'editor', 'editor_plus', 'site_admin']
      : ['viewer', 'editor', 'editor_plus']

  if (!inviteRole || !callerAllowedRoles.includes(inviteRole as Role)) {
    return apiError.badRequest(`role must be one of: ${callerAllowedRoles.join(', ')}`)
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedName = name.trim()
  const targetOrgId = orgId ?? session.user.orgId

  const normalizedRole = inviteRole as Role

  // Check user doesn't already exist
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [normalizedEmail],
  )
  if (existing) return apiError.badRequest('A user with this email already exists')

  // Create user with random temp password
  const tempPassword = randomBytes(24).toString('hex')
  const passwordHash = await bcrypt.hash(tempPassword, 12)

  const newUser = await queryOne<{ id: string }>(
    `INSERT INTO users (org_id, email, name, role, password_hash, signup_source)
     VALUES ($1, $2, $3, $4, $5, 'invited')
     RETURNING id`,
    [targetOrgId, normalizedEmail, normalizedName, normalizedRole, passwordHash],
  )
  if (!newUser) return apiError.serverError('Failed to create user')

  // Generate 1-hour invite token
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [newUser.id, tokenHash, expiresAt],
  )

  const inviteLink = `${process.env.APP_URL}/reset-password?token=${rawToken}`

  try {
    await sendInviteEmail(normalizedEmail, normalizedName, inviteLink)
  } catch (err) {
    logError('/api/users/invite', err, { email: normalizedEmail })
  }

  return NextResponse.json({ ok: true, userId: newUser.id })
}
