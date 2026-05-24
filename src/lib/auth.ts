import { type Role } from '@/types'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { ROLE_HIERARCHY } from '@/lib/roles'

export { ROLE_HIERARCHY }

const SECRET = new TextEncoder().encode(
  process.env.APP_SECRET ?? 'dev-secret-change-me'
)
const COOKIE_NAME = 'fsai_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export type SessionUser = {
  id: string
  email: string
  name: string
  role: Role
  orgId: string
}

export type Session = {
  user: SessionUser
}

// ---------------------------------------------------------------------------
// Create a signed JWT and set it as an httpOnly cookie
// ---------------------------------------------------------------------------
export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

// ---------------------------------------------------------------------------
// Read and verify the session cookie — returns null if missing or invalid
// ---------------------------------------------------------------------------
export async function auth(): Promise<Session | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null

    const { payload } = await jwtVerify(token, SECRET)
    const userId = payload.id as string

    // Verify user still exists in DB — catches deleted/recreated users
    const { queryOne } = await import('@/lib/db')
    const user = await queryOne<{ id: string; email: string; name: string | null; role: Role; org_id: string | null }>(
      'SELECT id, email, name, role, org_id FROM users WHERE id = $1',
      [userId],
    )

    if (!user) {
      // User was deleted — clear the stale session cookie
      cookieStore.delete(COOKIE_NAME)
      return null
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? '',
        role: user.role,
        orgId: user.org_id ?? '',
      },
    }
  } catch {
    // Clear a corrupt or invalid cookie so the browser doesn't get redirect-looped
    try {
      const cookieStore = await cookies()
      cookieStore.delete(COOKIE_NAME)
    } catch { /* ignore */ }
    return null
  }
}

// ---------------------------------------------------------------------------
// Clear the session cookie (logout)
// ---------------------------------------------------------------------------
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

// ---------------------------------------------------------------------------
// Validate credentials against DB and create session
// Returns error string or null on success
// ---------------------------------------------------------------------------
export async function signInWithCredentials(
  email: string,
  password: string,
): Promise<string | null> {
  try {
    const { queryOne } = await import('@/lib/db')
    const user = await queryOne<{
      id: string
      email: string
      name: string | null
      role: Role
      org_id: string | null
      password_hash: string
    }>(
      'SELECT id, email, name, role, org_id, password_hash FROM users WHERE email = $1',
      [email.trim().toLowerCase()],
    )

    if (!user) return 'Invalid email or password'

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return 'Invalid email or password'

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name ?? '',
      role: user.role,
      orgId: user.org_id ?? '',
    })

    return null
  } catch (err) {
    console.error('[auth] signInWithCredentials error:', err)
    return 'Server error — please try again'
  }
}
