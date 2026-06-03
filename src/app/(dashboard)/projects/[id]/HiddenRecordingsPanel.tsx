'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, RefreshCw, Loader2, Zap, Download } from 'lucide-react'

interface HiddenSession {
  id: string
  realpttId: string | null
  title: string | null
  recordedAt: string
  durationSecs: number | null
  status: 'SKIPPED' | 'FAILED' | 'INGESTED' | 'TRANSCRIBING'
  errorMessage: string | null
  mediaType: string | null
  realpttAccount: string | null
}

interface HiddenRecordingsPanelProps {
  projectId: string
  date: string
}

function formatRecordedTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Brisbane' })
}

const STATUS_STYLE: Record<string, string> = {
  SKIPPED: 'bg-gray-100 text-gray-600',
  FAILED: 'bg-red-100 text-red-700',
  INGESTED: 'bg-blue-100 text-blue-700',
  TRANSCRIBING: 'bg-yellow-100 text-yellow-700',
}

const STATUS_LABEL: Record<string, string> = {
  SKIPPED: 'Skipped (<30s)',
  FAILED: 'Failed',
  INGESTED: 'Stuck – ingested',
  TRANSCRIBING: 'Stuck – transcribing',
}

export function HiddenRecordingsPanel({ projectId, date }: HiddenRecordingsPanelProps) {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<HiddenSession[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({})

  // Reingest form state
  const [reingestId, setReingestId] = useState('')
  const [reingestBusy, setReingestBusy] = useState(false)
  const [reingestMsg, setReingestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    setOpen(false)
    setSessions([])
    setLoading(true)
    setReingestMsg(null)
    fetch(`/api/projects/${projectId}/hidden-sessions?date=${date}`)
      .then((r) => r.ok ? r.json() : { sessions: [] })
      .then((data) => setSessions(data.sessions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId, date])

  async function retryFailed(sessionId: string) {
    setActioning(sessionId)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/retry`, { method: 'POST' })
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      } else {
        const data = await res.json().catch(() => ({}))
        setActionMsg((prev) => ({ ...prev, [sessionId]: data.error ?? 'Retry failed' }))
      }
    } finally {
      setActioning(null)
    }
  }

  async function triggerTranscription(sessionId: string) {
    setActioning(sessionId)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/trigger-transcription`, { method: 'POST' })
      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) => s.id === sessionId ? { ...s, status: 'TRANSCRIBING' as const } : s)
        )
        setActionMsg((prev) => ({ ...prev, [sessionId]: 'Transcription triggered' }))
      } else {
        const data = await res.json().catch(() => ({}))
        setActionMsg((prev) => ({ ...prev, [sessionId]: data.error ?? 'Failed to trigger' }))
      }
    } finally {
      setActioning(null)
    }
  }

  async function reingest() {
    const id = reingestId.trim()
    if (!id) return
    setReingestBusy(true)
    setReingestMsg(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/reingest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ realpttId: id }),
      })
      const data = await res.json().catch(() => ({}))
      setReingestMsg({ ok: res.ok, text: data.message ?? (res.ok ? 'Triggered' : 'Failed') })
      if (res.ok) setReingestId('')
    } finally {
      setReingestBusy(false)
    }
  }

  if (loading) return null
  if (sessions.length === 0 && !open) {
    // Still render panel so the reingest form is accessible
  }

  const counts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  const summaryParts = [
    counts.SKIPPED ? `${counts.SKIPPED} skipped` : null,
    counts.FAILED ? `${counts.FAILED} failed` : null,
    (counts.INGESTED || counts.TRANSCRIBING)
      ? `${(counts.INGESTED ?? 0) + (counts.TRANSCRIBING ?? 0)} stuck`
      : null,
  ].filter(Boolean)

  const summary = summaryParts.length > 0 ? summaryParts.join(', ') : 'none'

  return (
    <div className="mt-3 border border-[#E5E7EB] rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#F9FAFB] text-left hover:bg-[#F3F4F6] transition-colors"
      >
        {open
          ? <ChevronDown size={13} className="text-[#9CA3AF] flex-shrink-0" />
          : <ChevronRight size={13} className="text-[#9CA3AF] flex-shrink-0" />
        }
        <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
          Hidden Recordings
        </span>
        <span className="text-xs text-[#9CA3AF]">({summary})</span>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
          SuperAdmin
        </span>
      </button>

      {open && (
        <>
          {/* Session list */}
          {sessions.length > 0 && (
            <ul className="divide-y divide-[#E5E7EB]">
              {sessions.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[#374151]">
                          {formatRecordedTime(s.recordedAt)}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status] ?? ''}`}>
                          {STATUS_LABEL[s.status] ?? s.status}
                        </span>
                        {s.durationSecs != null && (
                          <span className="text-xs text-[#9CA3AF]">{s.durationSecs}s</span>
                        )}
                      </div>
                      {s.realpttId && (
                        <p className="text-[11px] font-mono text-[#9CA3AF] mt-0.5">{s.realpttId}</p>
                      )}
                      {s.errorMessage && (
                        <p className="text-xs text-red-600 mt-1 line-clamp-2">{s.errorMessage}</p>
                      )}
                      {actionMsg[s.id] && (
                        <p className="text-xs text-[#6B7280] mt-1">{actionMsg[s.id]}</p>
                      )}
                    </div>

                    {/* FAILED → retry (re-download from RealPTT) */}
                    {s.status === 'FAILED' && (
                      <button
                        onClick={() => retryFailed(s.id)}
                        disabled={actioning === s.id}
                        className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-[#FFD966] text-[#111827] hover:bg-[#F5CC55] transition-colors disabled:opacity-50"
                      >
                        {actioning === s.id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                        Retry
                      </button>
                    )}

                    {/* INGESTED → trigger transcription (S3 event was missed) */}
                    {s.status === 'INGESTED' && (
                      <button
                        onClick={() => triggerTranscription(s.id)}
                        disabled={actioning === s.id}
                        className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-50"
                      >
                        {actioning === s.id ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                        Transcribe
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Re-ingest form — for recordings not in DB at all */}
          <div className="px-4 py-3 border-t border-[#E5E7EB] bg-[#F9FAFB]">
            <p className="text-xs font-semibold text-[#6B7280] mb-2 flex items-center gap-1.5">
              <Download size={12} />
              Re-ingest from RealPTT
            </p>
            <p className="text-[11px] text-[#9CA3AF] mb-2">
              For recordings not in the DB at all — paste the RealPTT file name (e.g. 2026-05-20-08-21-08).
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={reingestId}
                onChange={(e) => { setReingestId(e.target.value); setReingestMsg(null) }}
                onKeyDown={(e) => e.key === 'Enter' && reingest()}
                placeholder="YYYY-MM-DD-HH-MM-SS"
                className="flex-1 text-xs font-mono border border-[#E5E7EB] rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#FFD966] bg-white"
              />
              <button
                onClick={reingest}
                disabled={reingestBusy || !reingestId.trim()}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFD966] text-[#111827] hover:bg-[#F5CC55] transition-colors disabled:opacity-50"
              >
                {reingestBusy ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                Re-ingest
              </button>
            </div>
            {reingestMsg && (
              <p className={`text-xs mt-2 ${reingestMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
                {reingestMsg.text}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
