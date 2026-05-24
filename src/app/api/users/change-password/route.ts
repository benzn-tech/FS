/**
 * POST /api/users/change-password
 *
 * Allows any authenticated user to change their own password.
 * Requires current password verification.
 */

import { withAuth, apiError } from '@/lib/api-helpers'
import { queryOne } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export const POST = withAuth(async (req, session) => {
  let currentPassword: string, newPassword: string
  try {
    const body = await req.json()
    currentPassword = (body?.currentPassword ?? '').toString()
    newPassword = (body?.newPassword ?? '').toString()
  } catch {
    return apiError.badRequest('Invalid request body')
  }

  if (!currentPassword) return apiError.badRequest('Current password is required')
  if (!newPassword || newPassword.length < 8) {
    return apiError.badRequest('New password must be at least 8 characters')
  }
  if (currentPassword === newPassword) {
    return apiError.badRequest('New password must differ from current password')
  }

  const user = await queryOne<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE id = $1',
    [session.user.id],
  )
  if (!user) return apiError.notFound('User not found')

  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) return apiError.badRequest('Current password is incorrect')

  const newHash = await bcrypt.hash(newPassword, 12)
  await queryOne('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id])

  return NextResponse.json({ message: 'Password updated successfully' })
})
