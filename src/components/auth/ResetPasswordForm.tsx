'use client'

import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

function RequestNewLinkForm({ reason }: { reason: string }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await fetch('/api/auth/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-[#111827]">Check your email</h1>
        <p className="text-sm text-[#6B7280]">
          If an account exists for that email, a new invite link has been sent. The link expires in 24 hours.
        </p>
        <Link href="/login" className="text-sm font-medium text-[#FF8F00] hover:underline">
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[#111827]">Link expired</h1>
        <p className="text-sm text-[#6B7280]">{reason} Enter your email to receive a new invite link.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email address"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        {error && (
          <p className="text-sm text-[#EF4444] bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        <Button type="submit" size="lg" isLoading={loading} className="w-full">
          Send new link
        </Button>
      </form>
      <Link href="/login" className="text-sm text-center text-[#6B7280] hover:text-[#111827]">
        Back to login
      </Link>
    </div>
  )
}

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [expiredReason, setExpiredReason] = useState('')

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-[#111827]">Invalid reset link</h1>
        <p className="text-sm text-[#6B7280]">
          This reset link is missing or malformed. Please request a new one.
        </p>
        <Link href="/forgot-password" className="text-sm font-medium text-[#FF8F00] hover:underline">
          Request a new link
        </Link>
      </div>
    )
  }

  if (expired) {
    return <RequestNewLinkForm reason={expiredReason} />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        const msg = data.error ?? 'Something went wrong. Please try again.'
        if (msg.includes('expired') || msg.includes('already been used')) {
          setExpiredReason(msg + ' ')
          setExpired(true)
          return
        }
        setError(msg)
        return
      }

      router.push('/login?reset=success')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[#111827]">Set new password</h1>
        <p className="text-sm text-[#6B7280]">Choose a strong password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="New password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          label="Confirm password"
          type="password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />

        {error && (
          <p className="text-sm text-[#EF4444] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" isLoading={loading} className="w-full mt-1">
          Update password
        </Button>
      </form>
    </div>
  )
}
