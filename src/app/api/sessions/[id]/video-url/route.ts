import { withAuth, apiError } from '@/lib/api-helpers'
import { queryOne } from '@/lib/db'
import { getSignedVideoUrl } from '@/lib/s3'
import { NextResponse } from 'next/server'

// GET /api/sessions/[id]/video-url — pre-signed S3 URL (15 min expiry)
export const GET = withAuth(async (req, session, { params }) => {
  const id = (params as { id: string }).id

  const row = await queryOne<{ video_s3_key: string }>(
    'SELECT video_s3_key FROM sessions WHERE id = $1 AND org_id = $2',
    [id, session.user.orgId],
  )
  if (!row) return apiError.notFound('Session not found')
  if (!row.video_s3_key) return apiError.notFound('No video attached to this session')

  const url = await getSignedVideoUrl(row.video_s3_key)
  return NextResponse.json({ url })
})
