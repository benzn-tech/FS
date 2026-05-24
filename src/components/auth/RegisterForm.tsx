'use client'

import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function RegisterForm() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required.'
    if (!email.trim()) e.email = 'Email is required.'
    if (password.length < 8) e.password = 'Password must be at least 8 characters.'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = validate()
    if (Object.keys(validation).length) {
      setErrors(validation)
      return
    }
    setErrors({})
    setLoading(true)

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      if (!res.ok) {
        const data = await res.json()
        setErrors({ form: data.error ?? 'Registration failed. Please try again.' })
        return
      }

      // Auto sign-in after successful registration
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!loginRes.ok) {
        router.push('/login')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setErrors({ form: 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[#111827]">Create your account</h1>
        <p className="text-sm text-[#6B7280]">Get started with FieldSightAI for free</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Full name"
          type="text"
          placeholder="Jane Smith"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoComplete="name"
          required
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
          required
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          helperText="Minimum 8 characters"
          autoComplete="new-password"
          required
        />

        {errors.form && (
          <p className="text-sm text-[#EF4444] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errors.form}
          </p>
        )}

        <Button type="submit" size="lg" isLoading={loading} className="w-full mt-1">
          Create Account
        </Button>
      </form>

      <p className="text-sm text-center text-[#6B7280]">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-[#FF8F00] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
