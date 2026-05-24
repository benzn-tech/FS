import { LoginForm } from '@/components/auth/LoginForm'
import { type Metadata } from 'next'
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
