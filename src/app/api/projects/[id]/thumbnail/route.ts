import { withAuth, apiError } from '@/lib/api-helpers'
import { queryOne } from '@/lib/db'
import { getSignedUploadUrl } from '@/lib/s3'
import { NextResponse } from 'next/server'

// POST /api/projects/[id]/thumbnail
// Returns a pre-signed S3 PUT URL for uploading a project thumbnail.
// The client uploads directly to S3, then PATCHes the project with the final URL.
export const POST = withAuth(
  async (req, session, ctx) => {
    const projectId = ctx.params?.id as string
    const { contentType } = await req.json() as { contentType?: string }

    if (!contentType || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
      return apiError.badRequest('contentType must be image/jpeg, image/png, or image/webp')
    }

    const project = await queryOne<{ id: string; org_id: string }>(
      'SELECT id, org_id FROM projects WHERE id = $1',
      [projectId],
    )
    if (!project) return apiError.notFound('Project not found')

    // site_admin+ in same org, or super_admin
    if (session.user.role !== 'super_admin' && project.org_id !== session.user.orgId) {
      return apiError.forbidden()
    }

    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
    const key = `project-thumbnails/${projectId}/thumbnail.${ext}`

    let uploadUrl: string
    try {
      uploadUrl = await getSignedUploadUrl(key, contentType)
    } catch (err) {
      console.error('Failed to generate S3 presigned URL:', err)
      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
    }

    const mediaRegion = process.env.AWS_REGION ?? 'ap-southeast-2'
    const mediaBucket = process.env.S3_MEDIA_BUCKET ?? 'fsai-media'
    const publicUrl = `https://${mediaBucket}.s3.${mediaRegion}.amazonaws.com/${key}`

    return NextResponse.json({ uploadUrl, publicUrl })
  },
  { minRole: 'site_admin' },
)
