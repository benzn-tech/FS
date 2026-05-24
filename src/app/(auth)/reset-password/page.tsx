import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { type Metadata } from 'next'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Reset Password',
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
