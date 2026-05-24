import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { type Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Forgot Password',
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
