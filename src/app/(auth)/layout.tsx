import Link from 'next/link'
import { type ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link href="/" className="mb-8 text-2xl font-bold text-[#111827] tracking-tight">
        Field<span className="text-[#FFD966]">Sight</span>AI
      </Link>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">
        {children}
      </div>

      {/* Footer note */}
      <p className="mt-8 text-xs text-[#6B7280]">
        &copy; {new Date().getFullYear()} FieldSightAI. All rights reserved.
      </p>
    </div>
  )
}
