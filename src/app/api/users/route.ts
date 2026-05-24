import { withAuth, apiError } from '@/lib/api-helpers'
import { limits } from '@/lib/rate-limit'
import { queryOne, query } from '@/lib/db'
import { type Role } from '@/types'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { sendWelcomeEmail } from '@/lib/email'

const CUSTOMER_ROLES: Role[] = ['viewer', 'editor', 'editor_plus', 'site_admin']

// GET /api/users — list users in org
export const GET = withAuth(
  async (_req, session) => {
    const rows = await query<{
      id: string; org_id: string; email: string; name: string | null; role: string; created_at: string
    }>(
      'SELECT id, org_id, email, name, role, created_at FROM users WHERE org_id = $1 ORDER BY created_at DESC',
      [session.user.orgId],
    )
    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        orgId: r.org_id,
        email: r.email,
        name: r.name ?? undefined,
        role: r.role,
        createdAt: r.created_at,
      })),
    })
  },
  { minRole: 'site_admin' },
)

// POST /api/users — register a new user (public self-registration or admin invite)
export const POST = async (req: NextRequest) => {
  const limited = limits.auth(req)
  if (limited) return limited

  const body = await req.json()
  const { name, email, password, orgId, role = 'viewer' } = body as {
    name?: string
    email: string
    password: string
    orgId?: string
    role?: Role
  }

  if (!email || !password) return apiError.badRequest('email and password are required')
  if (password.length < 8) return apiError.badRequest('password must be at least 8 characters')

  const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])
  if (existing) return apiError.badRequest('An account with this email already exists')

  // Self-registration always goes to the Demo org + Demo Project.
  // Only admin invite flows (which supply orgId) can place users in real orgs.
  let targetOrgId = orgId
  let demoProjId: string | null = null

  if (!targetOrgId) {
    const demoOrg = await queryOne<{ id: string }>(
      "SELECT id FROM organisations WHERE name = 'Demo' LIMIT 1",
      [],
    )
    if (!demoOrg) return apiError.serverError('Demo organisation not found — contact your administrator')
    targetOrgId = demoOrg.id

    const demoProj = await queryOne<{ id: string }>(
      "SELECT id FROM projects WHERE org_id = $1 AND name = 'Demo Project' LIMIT 1",
      [targetOrgId],
    )
    demoProjId = demoProj?.id ?? null
  }

  const targetRole: Role = CUSTOMER_ROLES.includes(role as Role) ? (role as Role) : 'viewer'
  const passwordHash = await bcrypt.hash(password, 12)

  const isSelfRegistered = !orgId
  const user = await queryOne<{ id: string }>(
    `INSERT INTO users (org_id, email, name, role, password_hash, signup_source)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [targetOrgId, email, name ?? null, targetRole, passwordHash, isSelfRegistered ? 'self' : 'invited'],
  )

  // Add self-registered users to the Demo Project
  if (demoProjId && user) {
    await queryOne(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [demoProjId, user!.id],
    )
  }

  // Send welcome email to self-registered users
  if (isSelfRegistered && user) {
    await sendWelcomeEmail(email, name ?? 'there').catch(() => null)
  }

  return NextResponse.json({ data: { id: user!.id } }, { status: 201 })
}
