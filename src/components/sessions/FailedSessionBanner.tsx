'use client'

import { Button } from '@/components/ui/Button'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useState } from 'react'

interface FailedSessionBannerProps {
  sessionId: string
  errorMessage?: string
  retryCount: number
}

export function FailedSessionBanner({ sessionId, errorMessage, retryCount }: FailedSessionBannerProps) {
  const [loading, setLoading] = useState(false)
  const [retried, setRetried] = useState(false)

  async function handleRetry() {
    setLoading(true)
    try {
      await fetch(`/api/sessions/${sessionId}/retry`, { method: 'POST' })
      setRetried(true)
    } finally {
      setLoading(false)
    }
  }

  if (retried) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
        Pipeline re-triggered. Refresh in a moment to check status.
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-[#EF4444] flex-shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-[#EF4444]">Processing failed</p>
          {errorMessage && (
            <p className="text-xs text-red-600">{errorMessage}</p>
          )}
          {retryCount > 0 && (
            <p className="text-xs text-red-400">Retried {retryCount} time{retryCount !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>
      <Button
        variant="danger"
        size="sm"
        isLoading={loading}
        onClick={handleRetry}
        className="flex-shrink-0 gap-1.5"
      >
        <RotateCcw size={13} />
        Retry
      </Button>
    </div>
  )
}
