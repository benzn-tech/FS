import { MarketingNav } from '@/components/marketing/MarketingNav'
import { Footer } from '@/components/marketing/Footer'
import { type ReactNode } from 'react'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main className="pt-16">{children}</main>
      <Footer />
    </>
  )
}
