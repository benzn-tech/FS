'use client'

import { useEffect } from 'react'

// global-error.tsx catches errors in the root layout itself.
// It must include its own <html> and <body> tags.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error boundary]', error.digest, error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'sans-serif',
            backgroundColor: '#F9FAFB',
          }}
        >
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#111827' }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: '1rem', color: '#6B7280' }}>
            A critical error occurred. Please refresh the page.
          </p>
          {error.digest && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#9CA3AF' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: '2rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#FFD966',
              color: '#111827',
              fontWeight: 600,
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
