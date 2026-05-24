'use client'

import { useEffect, useRef } from 'react'

interface VideoPlayerProps {
  signedUrl?: string
  seekToSecs?: number
}

export function VideoPlayer({ signedUrl, seekToSecs }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Seek when parent passes a timestamp (e.g. clicking a transcript segment)
  useEffect(() => {
    if (seekToSecs !== undefined && videoRef.current) {
      videoRef.current.currentTime = seekToSecs
      videoRef.current.play()
    }
  }, [seekToSecs])

  if (!signedUrl) {
    return (
      <div className="flex items-center justify-center w-full aspect-video bg-[#111827] rounded-xl">
        <p className="text-sm text-gray-400">
          Video unavailable — URL not yet loaded
        </p>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      src={signedUrl}
      controls
      className="w-full aspect-video rounded-xl bg-[#111827] object-contain"
      preload="metadata"
    />
  )
}
