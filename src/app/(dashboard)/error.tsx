'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard error boundary]', error.digest, error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
      <h2 className="text-2xl font-bold text-[#111827]">Something went wrong</h2>
      <p className="mt-3 text-[#6B7280]">
        This page encountered an error. Your data is safe.
      </p>
      {error.digest && (
        <p className="mt-1 text-sm text-[#9CA3AF]">Error ID: {error.digest}</p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-[#FFD966] text-[#111827] font-semibold rounded-lg hover:bg-[#FFC107] transition-colors duration-200"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 border border-[#D1D5DB] text-[#374151] font-semibold rounded-lg hover:bg-[#F3F4F6] transition-colors duration-200"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
