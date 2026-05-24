'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SkipBack, SkipForward, Play, Pause, Volume2, Image as ImageIcon, Mic, Camera, Tag, Loader2, User } from 'lucide-react'
import Image from 'next/image'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DaySession {
  id: string
  title: string | null
  recordedAt: string
  durationSecs: number | null
  status: string
  mediaType: string | null
  signedUrl?: string
  speakerNames?: Record<string, string>
  aiTags?: { trades: string[]; actions: string[]; topics: string[] }
  segments: {
    id: string
    segmentIndex: number
    startSecs: number
    endSecs: number
    speaker?: string
    text: string
    isFinal: boolean
  }[]
}

export interface DayTab {
  date: string        // YYYY-MM-DD
  label: string       // 'Tue, Dec 9'
  count: number
}

interface ProjectDayViewProps {
  projectId: string
  days: DayTab[]
  initialDate: string
  initialSessions: DaySession[]
  canEdit?: boolean
  onDateChange?: (date: string, sessions: DaySession[]) => void
  // Search navigation: when set, view switches to this date+session+timecode
  searchNav?: { date: string; sessionId: string; startSecs: number; nonce: number } | null
  // Controlled date from external source (e.g. mini calendar in side panel)
  externalDate?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDuration(secs: number | null) {
  if (!secs) return null
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatRecordedTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function resolveSpeaker(label: string | undefined, speakerNames: Record<string, string> | undefined): string | undefined {
  if (!label) return undefined
  return speakerNames?.[label] ?? label
}

// ---------------------------------------------------------------------------
// Speaker name editor
// ---------------------------------------------------------------------------

function SpeakerNamesEditor({
  session,
  onSaved,
}: {
  session: DaySession
  onSaved: (names: Record<string, string>) => void
}) {
  const uniqueSpeakers = Array.from(new Set(session.segments.map((s) => s.speaker).filter(Boolean))) as string[]
  const [names, setNames] = useState<Record<string, string>>(session.speakerNames ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/speakers`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(names),
      })
      if (res.ok) {
        onSaved(names)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  if (uniqueSpeakers.length === 0) return null

  return (
    <div className="px-4 py-3 border-t border-[#E5E7EB] bg-[#F9FAFB]">
      <p className="text-xs font-semibold text-[#6B7280] mb-2">Name speakers</p>
      <div className="flex flex-col gap-2">
        {uniqueSpeakers.map((label) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#9CA3AF] w-14 flex-shrink-0">{label}</span>
            <input
              type="text"
              placeholder="Enter name…"
              value={names[label] ?? ''}
              onChange={(e) => setNames((prev) => ({ ...prev, [label]: e.target.value }))}
              className="flex-1 text-xs border border-[#E5E7EB] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#FF8F00]"
            />
          </div>
        ))}
        <button
          onClick={save}
          disabled={saving}
          className="self-start mt-1 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FF8F00] text-white hover:bg-[#E67E00] transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : null}
          {saved ? 'Saved!' : 'Save names'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI Tags display
// ---------------------------------------------------------------------------

function AiTagsSection({
  session,
  canEdit,
  onTagsGenerated,
}: {
  session: DaySession
  canEdit: boolean
  onTagsGenerated: (tags: DaySession['aiTags']) => void
}) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/sessions/${session.id}/tags`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        onTagsGenerated(data.tags)
      } else {
        setError('Failed to generate tags')
      }
    } catch {
      setError('Failed to generate tags')
    } finally {
      setGenerating(false)
    }
  }

  const tags = session.aiTags

  return (
    <div className="px-4 py-2 border-t border-[#E5E7EB]">
      {tags ? (
        <div className="flex flex-wrap gap-1.5 py-1">
          {tags.trades.map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{t}</span>
          ))}
          {tags.actions.map((a) => (
            <span key={a} className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 font-medium">{a}</span>
          ))}
          {tags.topics.map((tp) => (
            <span key={tp} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{tp}</span>
          ))}
        </div>
      ) : canEdit && session.segments.length > 0 ? (
        <div className="flex items-center gap-2 py-1">
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#FF8F00] transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 size={11} className="animate-spin" /> : <Tag size={11} />}
            {generating ? 'Generating tags…' : 'Generate tags'}
          </button>
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectDayView({ projectId, days, initialDate, initialSessions, canEdit = false, onDateChange, searchNav, externalDate }: ProjectDayViewProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [sessions, setSessions] = useState<DaySession[]>(initialSessions)
  const [loadingDay, setLoadingDay] = useState(false)
  const [showSpeakerEditor, setShowSpeakerEditor] = useState<string | null>(null)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentSecs, setCurrentSecs] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showVideo, setShowVideo] = useState(true)
  const pendingSeekRef = useRef<number | null>(null)

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)

// React to search navigation from shell — handles both same-date and cross-date jumps
  useEffect(() => {
    if (!searchNav) return
    const { date, sessionId, startSecs } = searchNav

    async function doNav() {
      // If we need to switch date, load sessions first
      if (date !== selectedDate) {
        setSelectedDate(date)
        setLoadingDay(true)
        setCurrentIndex(0)
        setPlaying(false)
        setCurrentSecs(0)
        try {
          const res = await fetch(`/api/projects/${projectId}/day-sessions?date=${date}`)
          if (res.ok) {
            const data = await res.json()
            const loaded: DaySession[] = data.sessions ?? []
            setSessions(loaded)
            onDateChange?.(date, loaded)
            const idx = loaded.findIndex((s) => s.id === sessionId)
            if (idx !== -1) {
              pendingSeekRef.current = startSecs
              setCurrentIndex(idx)
            }
          }
        } finally {
          setLoadingDay(false)
        }
      } else {
        // Same date — sessions already loaded
        const idx = sessions.findIndex((s) => s.id === sessionId)
        if (idx !== -1) {
          pendingSeekRef.current = startSecs
          setCurrentIndex(idx)
          setPlaying(false)
        }
      }
    }

    doNav()
  // nonce changes on every new search nav, triggering this effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchNav?.nonce])

  // React to date changes driven by the mini calendar (external)
  useEffect(() => {
    if (!externalDate || externalDate === selectedDate) return
    selectDate(externalDate)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalDate])

  // Probe duration for sessions that have a signed URL but no stored duration
  useEffect(() => {
    sessions.forEach((s, i) => {
      if (s.durationSecs || !s.signedUrl || s.mediaType === 'photo') return
      const el = document.createElement(s.mediaType === 'audio' ? 'audio' : 'video')
      el.preload = 'metadata'
      el.src = s.signedUrl
      el.onloadedmetadata = () => {
        if (isFinite(el.duration) && el.duration > 0) {
          setSessions((prev) => prev.map((ps, pi) =>
            pi === i && !ps.durationSecs ? { ...ps, durationSecs: Math.round(el.duration) } : ps
          ))
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.map(s => s.id).join(',')])

  const currentSession = sessions[currentIndex] ?? null
  const isAudio = currentSession?.mediaType === 'audio'
  const isPhoto = currentSession?.mediaType === 'photo'
  const isVideo = currentSession?.mediaType === 'video'

  // Load sessions when date changes
  async function selectDate(date: string) {
    if (date === selectedDate) return
    setSelectedDate(date)
    setLoadingDay(true)
    setCurrentIndex(0)
    setPlaying(false)
    setCurrentSecs(0)
    setShowVideo(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/day-sessions?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions)
        onDateChange?.(date, data.sessions)
      }
    } finally {
      setLoadingDay(false)
    }
  }

  // Track playback position via requestAnimationFrame
  const tick = useCallback(() => {
    const el = mediaRef.current
    if (el) setCurrentSecs(el.currentTime)
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing, tick])

  // Reset on session/date change
  useEffect(() => {
    setCurrentSecs(0)
    setDuration(0)
    setPlaying(false)
    setShowVideo(true)
  }, [currentIndex, selectedDate])

  function handleMediaRef(el: HTMLVideoElement | HTMLAudioElement | null) {
    mediaRef.current = el
    if (el) {
      el.onloadedmetadata = () => {
        const dur = el.duration
        setDuration(dur)
        // Write discovered duration back into the playlist entry so it displays
        if (dur && isFinite(dur)) {
          setSessions((prev) => prev.map((s, i) =>
            i === currentIndex && !s.durationSecs ? { ...s, durationSecs: Math.round(dur) } : s
          ))
        }
        // Apply pending seek from search navigation
        if (pendingSeekRef.current !== null) {
          const t = pendingSeekRef.current
          pendingSeekRef.current = null
          el.currentTime = t
          setCurrentSecs(t)
          el.play().then(() => setPlaying(true)).catch(() => {})
        }
      }
      el.onended = () => {
        setPlaying(false)
      }
    }
  }

  function togglePlay() {
    const el = mediaRef.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  function seekTo(secs: number) {
    const el = mediaRef.current
    if (!el) return
    el.currentTime = secs
    setCurrentSecs(secs)
    if (!playing) {
      el.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  function seekByClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    seekTo(pct * duration)
  }

  function skipTo(index: number) {
    if (index < 0 || index >= sessions.length) return
    setCurrentIndex(index)
    setPlaying(false)
  }

  function updateSessionSpeakerNames(sessionId: string, names: Record<string, string>) {
    setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, speakerNames: names } : s))
  }

  function updateSessionTags(sessionId: string, tags: DaySession['aiTags']) {
    setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, aiTags: tags } : s))
  }

  const progressPct = duration > 0 ? (currentSecs / duration) * 100 : 0

  const activeSegmentId = currentSession?.segments.find(
    (seg) => currentSecs >= seg.startSecs && currentSecs < seg.endSecs,
  )?.id

  const transcriptRef = useRef<HTMLDivElement>(null)
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (activeSegmentId && segmentRefs.current[activeSegmentId]) {
      segmentRefs.current[activeSegmentId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeSegmentId])

  if (days.length === 0) {
    return <p className="text-sm text-[#6B7280] py-4">No recordings with transcripts yet.</p>
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Date tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {days.map((day) => {
          const active = day.date === selectedDate
          return (
            <button
              key={day.date}
              onClick={() => selectDate(day.date)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-[#FFD966] text-[#111827]' : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
              }`}
            >
              <span className="block font-semibold">{day.label}</span>
              <span className={`block text-xs mt-0.5 ${active ? 'text-[#7A6200]' : 'text-[#9CA3AF]'}`}>
                {day.count} recording{day.count !== 1 ? 's' : ''}
              </span>
            </button>
          )
        })}
      </div>

      {loadingDay ? (
        <div className="flex items-center justify-center h-48 text-sm text-[#6B7280]">
          Loading recordings…
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-[#6B7280]">
          No recordings for this day.
        </div>
      ) : (
        <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
          {/* Player header */}
          <div className="px-4 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center gap-2 text-sm text-[#6B7280]">
            {isPhoto ? <ImageIcon size={14} className="text-[#9CA3AF]" /> : isAudio ? <Mic size={14} className="text-[#9CA3AF]" /> : null}
            <span>{isPhoto ? 'Viewing:' : 'Now playing:'}</span>
            <span className="font-semibold text-[#111827]">
              {isPhoto ? 'Photo' : 'Recording'} {currentIndex + 1} of {sessions.length}
            </span>
            <span>({formatRecordedTime(currentSession?.recordedAt ?? '')})</span>
            {isVideo && (
              <button
                onClick={() => setShowVideo((v) => !v)}
                title={showVideo ? 'Hide video' : 'Show video'}
                className={`ml-auto p-1 rounded transition-colors ${showVideo ? 'text-[#FFD966]' : 'text-[#9CA3AF] hover:text-[#374151]'}`}
              >
                <Camera size={14} />
              </button>
            )}
          </div>

          {/* Two-column: player left, transcript right */}
          <div className="flex" style={{ height: '600px' }}>
            {/* LEFT: video + controls + playlist */}
            <div className="flex flex-col border-r border-[#E5E7EB] overflow-hidden" style={{ width: '55%' }}>
              {/* Photo viewer */}
              {isPhoto && currentSession?.signedUrl && (
                <div className="flex items-center justify-center bg-black">
                  <Image
                    src={currentSession.signedUrl}
                    alt={currentSession.title ?? 'Site photo'}
                    width={800}
                    height={600}
                    className="max-h-80 w-auto object-contain"
                    unoptimized
                  />
                </div>
              )}

              {/* Video */}
              {isVideo && currentSession?.signedUrl && (
                <video
                  key={currentSession.id}
                  ref={handleMediaRef as React.RefCallback<HTMLVideoElement>}
                  src={currentSession.signedUrl}
                  preload="metadata"
                  className={showVideo ? 'w-full bg-black object-contain' : 'hidden'}
                  style={{ maxHeight: '320px' }}
                />
              )}

              {/* Progress bar + time */}
              {!isPhoto && (
                <div className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <div className="h-2 bg-[#E5E7EB] cursor-pointer relative" onClick={seekByClick}>
                    <div className="h-full bg-[#FFD966] transition-none" style={{ width: `${progressPct}%` }} />
                    <div
                      className="absolute top-1/2 w-3 h-3 rounded-full bg-[#FFD966] border-2 border-white shadow"
                      style={{ left: `${progressPct}%`, transform: 'translate(-50%, -50%)' }}
                    />
                  </div>
                  <div className="flex justify-between px-4 py-1">
                    <span className="font-mono text-xs text-[#6B7280]">{formatTime(currentSecs)}</span>
                    <span className="font-mono text-xs text-[#6B7280]">{duration > 0 ? formatTime(duration) : '0:00'}</span>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-3 px-4 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <button
                  onClick={() => skipTo(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#E5E7EB] transition-colors disabled:opacity-30"
                >
                  <SkipBack size={16} />
                </button>
                {!isPhoto && (
                  <button
                    onClick={togglePlay}
                    className="w-9 h-9 rounded-full bg-[#FFD966] flex items-center justify-center text-[#111827] hover:bg-[#F5CC55] transition-colors shadow"
                  >
                    {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>
                )}
                <button
                  onClick={() => skipTo(currentIndex + 1)}
                  disabled={currentIndex === sessions.length - 1}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#E5E7EB] transition-colors disabled:opacity-30"
                >
                  <SkipForward size={16} />
                </button>
                {isAudio && <Volume2 size={14} className="text-[#9CA3AF]" />}
                {isAudio && currentSession?.signedUrl && (
                  <audio
                    key={currentSession.id}
                    ref={handleMediaRef as React.RefCallback<HTMLAudioElement>}
                    src={currentSession.signedUrl}
                    preload="metadata"
                    className="hidden"
                  />
                )}
              </div>

              {/* Playlist */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                    Playlist ({sessions.length} recordings)
                  </p>
                </div>
                <ul className="divide-y divide-[#E5E7EB]">
                  {sessions.map((s, i) => {
                    const active = i === currentIndex
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => skipTo(i)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            active ? 'bg-[#FFF8E7]' : 'hover:bg-[#F9FAFB]'
                          }`}
                        >
                          <span className={`w-5 text-sm font-semibold flex-shrink-0 ${active ? 'text-[#7A6200]' : 'text-[#9CA3AF]'}`}>
                            {i + 1}
                          </span>
                          <span className={`flex-1 text-sm ${active ? 'text-[#111827] font-medium' : 'text-[#374151]'}`}>
                            <span className="font-medium">{formatRecordedTime(s.recordedAt)}</span>
                            {' — '}
                            {s.title ?? (s.mediaType === 'photo' ? `Photo ${i + 1}` : `Recording ${i + 1}`)}
                          </span>
                          {s.mediaType === 'photo' && <ImageIcon size={12} className={`flex-shrink-0 ${active ? 'text-[#7A6200]' : 'text-[#9CA3AF]'}`} />}
                          {s.mediaType === 'audio' && <Mic size={12} className={`flex-shrink-0 ${active ? 'text-[#7A6200]' : 'text-[#9CA3AF]'}`} />}
                          {formatDuration(s.durationSecs) && (
                            <span className={`text-xs flex-shrink-0 font-mono ${active ? 'text-[#7A6200]' : 'text-[#9CA3AF]'}`}>
                              {formatDuration(s.durationSecs)}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            {/* RIGHT: active transcript */}
            <div className="flex flex-col min-w-0 overflow-hidden" style={{ width: '45%' }}>
              {/* Transcript header */}
              <div className="px-4 py-2.5 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#7A6200]">
                    {formatRecordedTime(currentSession?.recordedAt ?? '')}
                  </span>
                  <span className="text-xs text-[#374151]">{currentSession?.title ?? `Recording ${currentIndex + 1}`}</span>
                  {playing && (
                    <span className="text-[10px] font-semibold text-[#7A6200] bg-[#FFF8E7] px-2 py-0.5 rounded-full">
                      Live
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && currentSession && currentSession.segments.length > 0 && (
                    <button
                      onClick={() => setShowSpeakerEditor(showSpeakerEditor === currentSession.id ? null : currentSession.id)}
                      title="Name speakers"
                      className="p-1 rounded text-[#9CA3AF] hover:text-[#FF8F00] transition-colors"
                    >
                      <User size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* AI tags for current session */}
              {currentSession && (
                <AiTagsSection
                  session={currentSession}
                  canEdit={canEdit}
                  onTagsGenerated={(tags) => updateSessionTags(currentSession.id, tags)}
                />
              )}

              {/* Speaker editor for current session */}
              {currentSession && showSpeakerEditor === currentSession.id && (
                <SpeakerNamesEditor
                  session={currentSession}
                  onSaved={(names) => updateSessionSpeakerNames(currentSession.id, names)}
                />
              )}

              {/* Transcript segments — scrollable, synced to playback */}
              <div ref={transcriptRef} className="flex-1 overflow-y-auto px-4 py-2">
                {!currentSession ? null
                  : currentSession.mediaType === 'photo' ? (
                    <p className="text-xs text-[#9CA3AF] italic py-3">Site photo — no transcript.</p>
                  ) : currentSession.segments.length === 0 ? (
                    <p className="text-xs text-[#9CA3AF] italic py-3">No transcript available.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {currentSession.segments.map((seg) => {
                        const isActive = seg.id === activeSegmentId
                        const displaySpeaker = resolveSpeaker(seg.speaker, currentSession.speakerNames)
                        return (
                          <div
                            key={seg.id}
                            ref={(el) => { segmentRefs.current[seg.id] = el }}
                            className={`flex gap-2 py-1.5 rounded px-2 cursor-pointer transition-colors ${
                              isActive ? 'bg-[#FFD966]/30' : 'hover:bg-[#F9FAFB]'
                            }`}
                            onClick={() => seekTo(seg.startSecs)}
                          >
                            <span className="text-[11px] font-mono text-[#7A6200] flex-shrink-0 mt-0.5 w-10">
                              {formatTime(seg.startSecs)}
                            </span>
                            <div className="flex-1 min-w-0">
                              {displaySpeaker && (
                                <p className="text-[10px] font-semibold text-[#6B7280] mb-0.5">{displaySpeaker}</p>
                              )}
                              <p className={`text-sm leading-relaxed ${isActive ? 'text-[#111827] font-medium' : 'text-[#374151]'}`}>
                                {seg.text}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
