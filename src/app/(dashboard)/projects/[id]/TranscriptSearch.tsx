'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, Loader2 } from 'lucide-react'

interface TranscriptSearchProps {
  projectId: string
  onNavigate?: (date: string, sessionId: string, startSecs: number) => void
}

interface SearchResult {
  segmentId: string
  sessionId: string
  sessionTitle?: string
  recordedAt: string
  startSecs: number
  text: string
  speakerLabel?: string
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatRecordedDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatRecordedTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function highlightMatch(text: string, query: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#FFD966] text-[#111827] rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function TranscriptSearchButton({ projectId, onNavigate }: TranscriptSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(''); setResults([]) }
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/search?q=${encodeURIComponent(q.trim())}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
      }
    } finally {
      setSearching(false)
    }
  }, [projectId])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  function handleResultClick(r: SearchResult) {
    const date = r.recordedAt.slice(0, 10)
    onNavigate?.(date, r.sessionId, r.startSecs)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
      >
        <Search size={14} />
        Search
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[70vh]">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E5E7EB]">
              <Search size={16} className="text-[#9CA3AF] flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search all transcripts in this project"
                className="flex-1 text-sm text-[#111827] placeholder-[#9CA3AF] outline-none"
              />
              {searching && <Loader2 size={14} className="text-[#9CA3AF] animate-spin flex-shrink-0" />}
              {query && !searching && (
                <button onClick={() => { setQuery(''); setResults([]) }} className="text-[#9CA3AF] hover:text-[#374151]">
                  <X size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="ml-1 text-xs text-[#6B7280] hover:text-[#111827] border border-[#E5E7EB] rounded px-1.5 py-0.5"
              >
                Esc
              </button>
            </div>

            {query.trim().length < 2 ? (
              <p className="px-4 py-8 text-center text-sm text-[#9CA3AF]">
                Type at least 2 characters to search
              </p>
            ) : searching ? (
              <p className="px-4 py-8 text-center text-sm text-[#9CA3AF]">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#9CA3AF]">
                No matches found for &ldquo;{query}&rdquo;
              </p>
            ) : (
              <div className="overflow-y-auto flex-1">
                <p className="px-4 pt-3 pb-1 text-xs text-[#6B7280]">
                  {results.length} match{results.length !== 1 ? 'es' : ''}
                  {results.length === 50 ? ' (showing first 50)' : ''}
                </p>
                <ul className="divide-y divide-[#F3F4F6]">
                  {results.map((r) => (
                    <li
                      key={r.segmentId}
                      className="px-4 py-3 hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                      onClick={() => handleResultClick(r)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold text-[#FF8F00]">
                          {formatRecordedDate(r.recordedAt)}
                        </span>
                        <span className="text-[10px] text-[#9CA3AF]">
                          {formatRecordedTime(r.recordedAt)}
                        </span>
                        <span className="text-xs text-[#374151] truncate">
                          {r.sessionTitle ?? 'Recording'}
                        </span>
                        <span className="text-[10px] font-mono text-[#9CA3AF] ml-auto flex-shrink-0">
                          {formatTime(r.startSecs)}
                        </span>
                      </div>
                      {r.speakerLabel && (
                        <p className="text-[10px] text-[#6B7280] mb-0.5">{r.speakerLabel}</p>
                      )}
                      <p className="text-sm text-[#374151] leading-relaxed line-clamp-2">
                        {highlightMatch(r.text, query)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
