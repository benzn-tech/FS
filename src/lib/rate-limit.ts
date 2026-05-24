/**
 * rate-limit.ts
 *
 * In-memory sliding-window rate limiter.
 * Uses a Map keyed by IP + route. Safe for serverless — each Lambda/Vercel
 * function instance gets its own map, which resets on cold start. This is
 * sufficient to block burst abuse. For cross-instance limiting, swap the
 * store for Upstash Redis (add UPSTASH_REDIS_REST_URL + TOKEN env vars).
 *
 * Usage:
 *   const result = rateLimit(req, { limit: 10, windowMs: 60_000 })
 *   if (!result.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 */

import { type NextRequest, NextResponse } from 'next/server'

interface RateLimitStore {
  count: number
  resetAt: number
}

// Module-level store — persists across requests within the same process
const store = new Map<string, RateLimitStore>()

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

interface RateLimitResult {
  ok: boolean
  /** Remaining requests in current window */
  remaining: number
  /** Epoch ms when the window resets */
  resetAt: number
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export function rateLimit(
  req: NextRequest,
  options: RateLimitOptions,
  /** Optional extra key (e.g. route name) so limits are per-route */
  routeKey = '',
): RateLimitResult {
  const ip = getIp(req)
  const key = `${ip}:${routeKey}`
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    // New window
    const resetAt = now + options.windowMs
    store.set(key, { count: 1, resetAt })
    return { ok: true, remaining: options.limit - 1, resetAt }
  }

  entry.count += 1

  if (entry.count > options.limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { ok: true, remaining: options.limit - entry.count, resetAt: entry.resetAt }
}

/**
 * Convenience helper — returns a 429 NextResponse if the limit is exceeded,
 * otherwise returns null (caller proceeds normally).
 */
export function rateLimitResponse(
  req: NextRequest,
  options: RateLimitOptions,
  routeKey = '',
): NextResponse | null {
  const result = rateLimit(req, options, routeKey)
  if (!result.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(options.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      },
    )
  }
  return null
}

// Pre-configured limiters for reuse across routes
export const limits = {
  /** Auth endpoints — 10 attempts per 15 minutes */
  auth: (req: NextRequest) =>
    rateLimitResponse(req, { limit: 10, windowMs: 15 * 60 * 1000 }, 'auth'),

  /** Password reset requests — 5 per hour */
  passwordReset: (req: NextRequest) =>
    rateLimitResponse(req, { limit: 5, windowMs: 60 * 60 * 1000 }, 'password-reset'),

  /** Export triggers — 20 per minute */
  export: (req: NextRequest) =>
    rateLimitResponse(req, { limit: 20, windowMs: 60 * 1000 }, 'export'),

  /** General API — 100 per minute */
  api: (req: NextRequest) =>
    rateLimitResponse(req, { limit: 100, windowMs: 60 * 1000 }, 'api'),

  /** Webhook ingestion — 60 per minute */
  webhook: (req: NextRequest) =>
    rateLimitResponse(req, { limit: 60, windowMs: 60 * 1000 }, 'webhook'),

  /** Email-sending endpoints (contact form, invites) — 10 per hour */
  email: (req: NextRequest) =>
    rateLimitResponse(req, { limit: 10, windowMs: 60 * 60 * 1000 }, 'email'),
}
