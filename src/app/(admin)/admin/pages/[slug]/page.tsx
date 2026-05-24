import { type Metadata } from 'next'
import { getContent, EDITABLE_PAGES } from '@/lib/content'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { ContentEditor } from './ContentEditor'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Edit Content' }

export default async function ContentEditorPage({
  params,
}: {
  params: { slug: string }
}) {
  const pageInfo = EDITABLE_PAGES.find((p) => p.slug === params.slug)
  if (!pageInfo) notFound()

  const content = await getContent(params.slug)

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB] transition-colors"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">{pageInfo.label}</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{pageInfo.description}</p>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <p className="text-xs text-[#6B7280]">
            Changes are saved immediately and reflected on the live site. Leave a field blank to revert to the built-in default.
          </p>
        </div>
        <ContentEditor slug={params.slug} initialContent={content} />
      </Card>
    </div>
  )
}
