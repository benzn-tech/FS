import { auth } from '@/lib/auth'
import { ROLE_HIERARCHY, hasMinRole } from '@/lib/roles'
import { type Role } from '@/types'

export { hasMinRole }
import { NextResponse, type NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Structured error logger — outputs JSON so CloudWatch can filter by fields
// ---------------------------------------------------------------------------
export function logError(route: string, err: unknown, context?: Record<string, unknown>) {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  console.error(JSON.stringify({ level: 'ERROR', route, message, stack, ...context }))
}

// Next.js 16: params is a Promise
type RouteContext = { params?: Promise<Record<string, string | string[]>> | Record<string, string | string[]> }

type AuthenticatedHandler = (
  req: NextRequest,
  session: { user: { id: string; email: string; role: Role; orgId: string } },
  context: { params?: Record<string, string | string[]> },
) => Promise<NextResponse> | NextResponse

// ---------------------------------------------------------------------------
// withAuth — wraps an API route handler, enforcing authentication.
// Optionally enforces a minimum role level.
// ---------------------------------------------------------------------------
export function withAuth(
  handler: AuthenticatedHandler,
  options?: { minRole?: Role; exactRole?: Role },
) {
  return async (req: NextRequest, context: RouteContext) => {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const userRank = ROLE_HIERARCHY[session.user.role]

    if (options?.minRole !== undefined) {
      const required = ROLE_HIERARCHY[options.minRole]
      if (userRank < required) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (options?.exactRole !== undefined && session.user.role !== options.exactRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Next.js 16: params may be a Promise — resolve it before passing
    const resolvedParams = context.params instanceof Promise
      ? await context.params
      : context.params

    try {
      return await handler(req, session as Parameters<AuthenticatedHandler>[1], { params: resolvedParams })
    } catch (err) {
      logError(req.nextUrl.pathname, err, { method: req.method })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}

// ---------------------------------------------------------------------------
// Standalone role-check helpers (for use inside Server Components / actions)
// ---------------------------------------------------------------------------
export function requireRole(userRole: Role, required: Role): void {
  if (!hasMinRole(userRole, required)) {
    throw new Error('Forbidden')
  }
}

// ---------------------------------------------------------------------------
// Standard JSON error responses
// ---------------------------------------------------------------------------
export const apiError = {
  unauthorized: () => NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }),
  forbidden: (msg = 'Forbidden') => NextResponse.json({ error: msg }, { status: 403 }),
  notFound: (msg = 'Not found') => NextResponse.json({ error: msg }, { status: 404 }),
  badRequest: (msg: string) => NextResponse.json({ error: msg }, { status: 400 }),
  serverError: (msg = 'Internal server error') =>
    NextResponse.json({ error: msg }, { status: 500 }),
}
