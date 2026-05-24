import { siteConfig } from '@/config/site'
import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="bg-[#111827] text-white py-16 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-10">
        {/* Brand column */}
        <div className="flex flex-col gap-4 md:col-span-1">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Image src="/logo.png" alt="FieldSightAI logo" width={32} height={32} className="object-contain" />
            Field<span className="text-[#FFD966]">Sight</span>AI™
          </Link>
          <p className="text-sm text-gray-400 leading-relaxed">
            {siteConfig.tagline}
          </p>
        </div>

        {/* Link columns */}
        {siteConfig.footer.columns.map((col) => (
          <div key={col.heading} className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-widest">
              {col.heading}
            </h4>
            <ul className="flex flex-col gap-2">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-[#FFD966] transition-colors duration-150"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-xs text-gray-500">
          &copy; {new Date().getFullYear()} FieldSightAI™. All rights reserved.
        </p>
        <p className="text-xs text-gray-500">
          Built for the construction industry.
        </p>
      </div>
    </footer>
  )
}
