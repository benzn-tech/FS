'use client'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Upload, CheckCircle, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export function MediaUploader() {
  const [state, setState] = useState<UploadState>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const file = files[0]

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Only image files are supported.')
      setState('error')
      return
    }

    setState('uploading')
    setErrorMsg(null)
    setUploadedUrl(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/media', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(data.error ?? 'Upload failed.')
        setState('error')
        return
      }

      const { url } = await res.json()
      setUploadedUrl(url)
      setState('success')
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setState('error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-colors',
          dragOver
            ? 'border-[#FFD966] bg-[#FFFDE7]'
            : 'border-[#E5E7EB] bg-white hover:border-[#FFD966] hover:bg-[#FFFDE7]/50',
        )}
      >
        <div className="w-12 h-12 rounded-xl bg-[#FFFDE7] flex items-center justify-center">
          <Upload size={22} className="text-[#FF8F00]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-[#111827]">Drop an image here, or click to browse</p>
          <p className="text-xs text-[#6B7280] mt-1">PNG, JPG, WebP, SVG · Max 5 MB</p>
        </div>
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}>
          Choose File
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* State feedback */}
      {state === 'uploading' && (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <span className="inline-block w-4 h-4 border-2 border-[#FFD966] border-t-transparent rounded-full animate-spin" />
          Uploading…
        </div>
      )}
      {state === 'success' && uploadedUrl && (
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
          <p className="flex items-center gap-2 text-sm text-green-700 font-medium">
            <CheckCircle size={16} /> Uploaded successfully
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 text-xs bg-white border border-green-200 rounded px-2 py-1.5 text-[#111827] truncate">
              {uploadedUrl}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigator.clipboard.writeText(uploadedUrl)}
            >
              Copy URL
            </Button>
          </div>
        </div>
      )}
      {state === 'error' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
          <XCircle size={16} className="text-[#EF4444] flex-shrink-0" />
          <p className="text-sm text-[#EF4444]">{errorMsg}</p>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setState('idle')}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  )
}
