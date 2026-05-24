'use client'

import { Button } from '@/components/ui/Button'
import { type ContentItem } from '@/lib/content'
import { Check, RotateCcw } from 'lucide-react'
import { useState } from 'react'

interface ContentEditorProps {
  slug: string
  initialContent: Record<string, ContentItem>
}

function humaniseKey(key: string) {
  return key
    .replace(/\./g, ' → ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ContentEditor({ slug, initialContent }: ContentEditorProps) {
  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initialContent).map(([k, v]) => [k, v.value])),
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function saveField(key: string) {
    setSaving(key)
    try {
      await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageSlug: slug, key, value: fields[key] }),
      })
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    } finally {
      setSaving(null)
    }
  }

  function resetField(key: string) {
    setFields((prev) => ({ ...prev, [key]: initialContent[key]?.value ?? '' }))
  }

  const entries = Object.entries(fields)

  // Group by first segment (e.g. "hero", "features", "cta")
  const groups: Record<string, string[]> = {}
  for (const [key] of entries) {
    const group = key.split('.')[0]
    if (!groups[group]) groups[group] = []
    groups[group].push(key)
  }

  return (
    <div className="divide-y divide-[#E5E7EB]">
      {Object.entries(groups).map(([group, keys]) => (
        <div key={group} className="px-6 py-5 flex flex-col gap-4">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest capitalize">
            {group.replace(/_/g, ' ')}
          </p>
          {keys.map((key) => {
            const isLong = fields[key]?.length > 80
            const isDirty = fields[key] !== initialContent[key]?.value
            const isSaved = saved === key

            return (
              <div key={key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[#111827]">
                    {humaniseKey(key.replace(`${group}.`, ''))}
                  </label>
                  <span className="text-xs font-mono text-[#6B7280]">{key}</span>
                </div>

                {isLong ? (
                  <textarea
                    value={fields[key]}
                    onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD966] focus:border-[#FFD966] resize-none transition-colors"
                  />
                ) : (
                  <input
                    type="text"
                    value={fields[key]}
                    onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD966] focus:border-[#FFD966] transition-colors"
                  />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    isLoading={saving === key}
                    disabled={!isDirty && !isSaved}
                    onClick={() => saveField(key)}
                    className="gap-1.5"
                  >
                    {isSaved ? (
                      <><Check size={13} /> Saved</>
                    ) : (
                      'Save'
                    )}
                  </Button>
                  {isDirty && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => resetField(key)}
                      className="gap-1 text-[#6B7280]"
                    >
                      <RotateCcw size={12} /> Reset
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
