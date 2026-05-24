import { withAuth, apiError } from '@/lib/api-helpers'
import { uploadMediaBuffer } from '@/lib/s3'
import { NextResponse } from 'next/server'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

// POST /api/admin/media — upload image to fieldsightai-media S3 bucket
export const POST = withAuth(
  async (req) => {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError.badRequest('file is required')
    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiError.badRequest('Only JPEG, PNG, WebP, and SVG images are supported')
    }
    if (file.size > MAX_FILE_SIZE) {
      return apiError.badRequest('File size must be under 5 MB')
    }

    const ext = file.name.split('.').pop() ?? 'bin'
    const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '_')
    const key = `media/${Date.now()}-${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const url = await uploadMediaBuffer(key, buffer, file.type)

    return NextResponse.json({ url })
  },
  { exactRole: 'super_admin' },
)
