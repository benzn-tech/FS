'use client'

import { siteConfig } from '@/config/site'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E5E7EB]"
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0 flex items-center gap-2">
          <Image src="/logo.png" alt="FieldSightAI logo" width={32} height={32} className="object-contain" />
          <span className="text-xl font-bold text-[#111827] tracking-tight">
            Field<span className="text-[#FFD966]">Sight</span>AI™
          </span>
        </Link>

        {/* Centre nav tabs — desktop */}
        <nav className="flex-1 hidden md:flex items-center justify-center gap-1">
          {siteConfig.nav.marketing.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB] rounded-lg transition-colors duration-150"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right — Log In button */}
        <div className="flex-shrink-0 hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button variant="outline" size="sm">
              Log In
            </Button>
          </Link>
          <Link href="/register">
            <Button variant="primary" size="sm">
              Get Started
            </Button>
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="ml-auto md:hidden p-2 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB] transition-colors"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#E5E7EB] bg-white px-6 py-4 flex flex-col gap-2">
          {siteConfig.nav.marketing.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="py-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <div className={cn('flex flex-col gap-2 pt-3 border-t border-[#E5E7EB]')}>
            <Link href="/login" onClick={() => setMobileOpen(false)}>
              <Button variant="outline" size="sm" className="w-full">
                Log In
              </Button>
            </Link>
            <Link href="/register" onClick={() => setMobileOpen(false)}>
              <Button variant="primary" size="sm" className="w-full">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      )}
    </motion.header>
  )
}
