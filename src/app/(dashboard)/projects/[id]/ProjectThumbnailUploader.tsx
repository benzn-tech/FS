'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface Props {
  projectId: string
  thumbnailUrl: string | null
  canEdit: boolean
}

export function ProjectThumbnailUploader({ projectId, thumbnailUrl, canEdit }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(thumbnailUrl)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP images are supported')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB')
      return
    }

    setUploading(true)
    setError('')

    try {
      // 1. Get pre-signed upload URL
      const res = await fetch(`/api/projects/${projectId}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail ?? data.error ?? 'Failed to get upload URL')
        return
      }
      const { uploadUrl, publicUrl } = await res.json() as { uploadUrl: string; publicUrl: string }

      // 2. Upload directly to S3
      const upload = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!upload.ok) {
        setError('Upload failed')
        return
      }

      // 3. Save URL to project
      const patch = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnailUrl: publicUrl }),
      })
      if (!patch.ok) {
        setError('Failed to save thumbnail')
        return
      }

      setPreview(publicUrl)
      router.refresh()
    } catch (err) {
      console.error('Thumbnail upload error:', err)
      setError('Network error')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="relative group w-full aspect-video bg-[#F3F4F6] rounded-xl overflow-hidden">
      {preview ? (
        <Image
          src={preview}
          alt="Project thumbnail"
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <Camera size={32} className="text-[#D1D5DB]" />
        </div>
      )}

      {canEdit && (
        <label className={`
          absolute inset-0 flex items-center justify-center cursor-pointer
          bg-black/0 hover:bg-black/40 transition-all
          ${uploading ? 'bg-black/40' : ''}
        `}>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {uploading ? (
            <Loader2 size={24} className="text-white animate-spin" />
          ) : (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-white text-sm font-medium">
              <Camera size={15} />
              {preview ? 'Change photo' : 'Add photo'}
            </span>
          )}
        </label>
      )}

      {error && (
        <p className="absolute bottom-2 left-2 right-2 text-center text-xs text-white bg-red-500/80 rounded px-2 py-1">
          {error}
        </p>
      )}
    </div>
  )
}
