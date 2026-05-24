import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { apiError, hasMinRole } from '@/lib/api-helpers'
import { sendInviteEmail } from '@/lib/email'
import { randomBytes, createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { type Role } from '@/types'

const INVITE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// POST /api/projects/[id]/members/invite
// Body: { email, name, role }
// Creates a new user (or finds existing) and invites them to the project.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()

  const { role: callerRole, orgId } = session.user
  if (!hasMinRole(callerRole, 'super_admin')) return apiError.forbidden()

  const body = await req.json().catch(() => ({}))
  const { email, name, role: inviteRole } = body as {
    email?: string
    name?: string
    role?: string
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return apiError.badRequest('Valid email required')
  }
  if (!name || name.trim().length < 1) {
    return apiError.badRequest('Name required')
  }

  const allowedRoles: Role[] = ['viewer', 'editor', 'editor_plus', 'site_admin']
  if (!inviteRole || !allowedRoles.includes(inviteRole as Role)) {
    return apiError.badRequest(`role must be one of: ${allowedRoles.join(', ')}`)
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedName = name.trim()

  // Verify project belongs to caller's org
  const project = await queryOne<{ id: string; org_id: string }>(
    'SELECT id, org_id FROM projects WHERE id = $1',
    [projectId],
  )
  if (!project) return apiError.notFound('Project not found')
  if (project.org_id !== orgId && callerRole !== 'super_admin') {
    return apiError.notFound('Project not found')
  }
  const targetOrgId = project.org_id

  // Check if user already exists
  let existing = await queryOne<{ id: string; org_id: string | null }>(
    'SELECT id, org_id FROM users WHERE email = $1',
    [normalizedEmail],
  )

  let userId: string
  if (existing) {
    userId = existing.id
  } else {
    // Create new user with a random password (they'll set their own via invite link)
    const tempPassword = randomBytes(24).toString('hex')
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    const newUser = await queryOne<{ id: string }>(
      `INSERT INTO users (org_id, email, name, role, password_hash, signup_source)
       VALUES ($1, $2, $3, $4, $5, 'invited')
       RETURNING id`,
      [targetOrgId, normalizedEmail, normalizedName, inviteRole, passwordHash],
    )
    if (!newUser) return apiError.serverError('Failed to create user')
    userId = newUser.id
  }

  // Add to project_members if not already a member
  await query(
    `INSERT INTO project_members (project_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (project_id, user_id) DO NOTHING`,
    [projectId, userId],
  )

  // Generate an invite token (7-day TTL, stored in password_reset_tokens)
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
    await sendInviteEmail(normalizedEmail, normalizedName, inviteLink)
  } catch (err) {
    console.error('[invite] SES send failed:', err)
    // Don't fail the request — user and token are created, invite link can be resent
  }

  return NextResponse.json({ ok: true, userId })
}
