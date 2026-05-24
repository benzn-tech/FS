'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Client-side boundary — logger is not available here, console is intentional
    console.error('[app error boundary]', error.digest, error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB]">
      <h1 className="text-4xl font-bold text-[#111827]">Something went wrong</h1>
      <p className="mt-4 text-lg text-[#6B7280]">
        An unexpected error occurred. Our team has been notified.
      </p>
      {error.digest && (
        <p className="mt-2 text-sm text-[#9CA3AF]">Error ID: {error.digest}</p>
      )}
      <div className="mt-8 flex gap-4">
        <button
          onClick={reset}
          className="px-6 py-3 bg-[#FFD966] text-[#111827] font-semibold rounded-lg hover:bg-[#FFC107] transition-colors duration-200"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-6 py-3 border border-[#D1D5DB] text-[#374151] font-semibold rounded-lg hover:bg-[#F3F4F6] transition-colors duration-200"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
