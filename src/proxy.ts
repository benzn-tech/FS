import { jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'

const SECRET = new TextEncoder().encode(
  process.env.APP_SECRET ?? 'dev-secret-change-me',
)
const COOKIE_NAME = 'fsai_session'

const ALLOWED_ORIGINS =
  process.env.NODE_ENV === 'production'
    ? ['https://fieldsightai.com', 'https://main.d19u3207g5s0sc.amplifyapp.com']
    : ['http://localhost:3000']

function setCorsHeaders(res: NextResponse, origin: string) {
  res.headers.set('Access-Control-Allow-Origin', origin)
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
}

async function getSession(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, SECRET)
    return payload
  } catch {
    return null
  }
}

export default async function middleware(req: NextRequest) {
  const { nextUrl } = req
  const origin = req.headers.get('origin') ?? ''
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin)

  // Handle CORS preflight for API routes
  if (req.method === 'OPTIONS' && nextUrl.pathname.startsWith('/api/')) {
    const res = new NextResponse(null, { status: 204 })
    if (isAllowedOrigin) setCorsHeaders(res, origin)
    return res
  }

  const session = await getSession(req)
  const isAuthenticated = !!session

  // Routes that require authentication
  const protectedPrefixes = ['/dashboard', '/sessions', '/settings', '/admin']
  const isProtected = protectedPrefixes.some((prefix) =>
    nextUrl.pathname.startsWith(prefix),
  )

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', nextUrl.origin)
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // /admin is super_admin only
  if (
    nextUrl.pathname.startsWith('/admin') &&
    isAuthenticated &&
    session.role !== 'super_admin'
  ) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl.origin))
  }

  // Already authenticated users shouldn't hit login/register/forgot-password
  // But /reset-password is allowed — the page clears the session itself
  const authOnlyPaths = ['/login', '/register', '/forgot-password']
  if (isAuthenticated && authOnlyPaths.includes(nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl.origin))
  }

  const res = NextResponse.next()
  if (isAllowedOrigin && nextUrl.pathname.startsWith('/api/')) {
    setCorsHeaders(res, origin)
  }
  return res
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/sessions/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ],
}
