import { type Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { MediaUploader } from './MediaUploader'

export const metadata: Metadata = { title: 'Media Library' }

export default function MediaPage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Media Library</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Upload images for the landing page. Files are stored in the{' '}
          <code className="text-xs bg-[#F9FAFB] px-1 py-0.5 rounded border border-[#E5E7EB]">
            fieldsightai-media
          </code>{' '}
          S3 bucket.
        </p>
      </div>

      <MediaUploader />

      {/* Uploaded assets — placeholder until API is wired */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#111827]">Uploaded Assets</h2>
        </div>
        <div className="px-6 py-12 flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-[#6B7280]">No assets uploaded yet.</p>
          <p className="text-xs text-[#6B7280]">
            Asset list will load from S3 once the media API is wired (Phase 9).
          </p>
        </div>
      </Card>
    </div>
  )
}
