'use client'

import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { useState } from 'react'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (res.status === 429) {
        setError('Too many requests. Please wait a few minutes and try again.')
        return
      }

      // Always show success — avoids leaking whether the email exists
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-[#111827]">Check your email</h1>
          <p className="text-sm text-[#6B7280]">
            If an account exists for <span className="font-medium text-[#111827]">{email}</span>,
            you&apos;ll receive a password reset link within a few minutes. The link expires in 15 minutes.
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-[#FF8F00] hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[#111827]">Forgot password</h1>
        <p className="text-sm text-[#6B7280]">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        {error && (
          <p className="text-sm text-[#EF4444] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" isLoading={loading} className="w-full mt-1">
          Send reset link
        </Button>
      </form>

      <p className="text-sm text-center text-[#6B7280]">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-[#FF8F00] hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
