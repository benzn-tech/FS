import { type Metadata } from 'next'
import { EDITABLE_PAGES, getContent } from '@/lib/content'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FileText, Image, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = { title: 'CMS Overview' }

export default async function AdminOverviewPage() {
  // Fetch content for all pages to show last-updated info
  const pageData = await Promise.all(
    EDITABLE_PAGES.map(async (page) => {
      const content = await getContent(page.slug)
      const keys = Object.keys(content)
      const lastUpdated = Object.values(content)
        .map((c) => c.updatedAt)
        .filter(Boolean)
        .sort()
        .at(-1)
      return { ...page, keyCount: keys.length, lastUpdated }
    }),
  )

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Content Overview</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Edit landing page text, images, and site-wide copy. Changes appear live immediately.
        </p>
      </div>

      {/* Page sections */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Pages</h2>
        {pageData.map((page) => (
          <Link key={page.slug} href={`/admin/pages/${page.slug}`}>
            <Card className="flex items-center gap-4 hover:border-[#FFD966] transition-colors cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-[#FFFDE7] flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-[#FF8F00]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#111827] group-hover:text-[#FF8F00] transition-colors">
                  {page.label}
                </p>
                <p className="text-xs text-[#6B7280]">{page.description}</p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {page.keyCount} content {page.keyCount === 1 ? 'field' : 'fields'}
                  {page.lastUpdated
                    ? ` · Last updated ${new Date(page.lastUpdated).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
                    : ' · Using defaults'}
                </p>
              </div>
              <ChevronRight size={16} className="text-[#E5E7EB] group-hover:text-[#FFD966] transition-colors flex-shrink-0" />
            </Card>
          </Link>
        ))}
      </div>

      {/* Media */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Assets</h2>
        <Link href="/admin/media">
          <Card className="flex items-center gap-4 hover:border-[#FFD966] transition-colors cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-[#FFFDE7] flex items-center justify-center flex-shrink-0">
              <Image size={18} className="text-[#FF8F00]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#111827] group-hover:text-[#FF8F00] transition-colors">
                Media Library
              </p>
              <p className="text-xs text-[#6B7280]">Upload and manage images for the landing page</p>
            </div>
            <ChevronRight size={16} className="text-[#E5E7EB] group-hover:text-[#FFD966] transition-colors flex-shrink-0" />
          </Card>
        </Link>
      </div>

      {/* Info box */}
      <div className="p-4 rounded-xl bg-[#FFFDE7] border border-[#FFD966]/40 text-sm text-[#111827]/70">
        <p className="font-semibold text-[#FF8F00] mb-1">How it works</p>
        <p>
          Edits made here are saved to the database and take effect immediately on the live site.
          If no override exists, the site falls back to the built-in defaults from{' '}
          <code className="text-xs bg-white/80 px-1 py-0.5 rounded">src/config/site.ts</code>.
        </p>
      </div>
    </div>
  )
}
