'use client'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { type TranscriptSegment } from '@/types'
import { Check, Edit3, Trash2, RotateCcw, Mail, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface TranscriptPanelProps {
  segments: TranscriptSegment[]
  onSeek?: (secs: number) => void
  sessionId: string
  canEdit: boolean
  userEmail?: string
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface LocalSegment extends TranscriptSegment {
  isDeleted?: boolean
}

function SegmentRow({
  segment,
  onSeek,
  canEdit,
  onSave,
  onDelete,
  onRestore,
  onRestoreOriginal,
}: {
  segment: LocalSegment
  onSeek?: (secs: number) => void
  canEdit: boolean
  onSave: (id: string, text: string) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onRestoreOriginal: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(segment.editedText ?? segment.originalText)

  function handleSave() {
    onSave(segment.id, draft)
    setEditing(false)
  }

  const displayText = segment.editedText ?? segment.originalText
  const isEdited = !!segment.editedText && segment.editedText !== segment.originalText

  if (segment.isDeleted) {
    return (
      <div className="flex gap-3 py-2 px-4 rounded-lg bg-red-50 border border-red-100 opacity-60">
        <span className="flex-shrink-0 text-xs font-mono text-red-400 mt-0.5 w-10">
          {formatTime(segment.startSecs)}
        </span>
        <p className="flex-1 text-sm text-red-400 line-through italic truncate">{segment.originalText}</p>
        {canEdit && (
          <button
            onClick={() => onRestore(segment.id)}
            className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
            title="Restore deleted segment"
          >
            <RotateCcw size={13} /> Restore
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex gap-3 py-3 px-4 group hover:bg-[#F9FAFB] rounded-lg transition-colors">
      {/* Timestamp */}
      <button
        onClick={() => onSeek?.(segment.startSecs)}
        className="flex-shrink-0 text-xs font-mono text-[#FFD966] hover:text-[#FF8F00] transition-colors mt-0.5 w-10 text-left"
        title="Jump to this moment"
      >
        {formatTime(segment.startSecs)}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {segment.speaker && (
          <p className="text-xs font-semibold text-[#6B7280] mb-1">{segment.speaker}</p>
        )}
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full text-sm text-[#111827] border border-[#FFD966] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FFD966] resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={handleSave} className="gap-1">
                <Check size={13} /> Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setDraft(segment.editedText ?? segment.originalText); setEditing(false) }}
              >
                Cancel
              </Button>
              {isEdited && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { onRestoreOriginal(segment.id); setEditing(false) }}
                  className="gap-1 text-[#6B7280]"
                >
                  <RotateCcw size={12} /> Restore original
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p className={cn('text-sm leading-relaxed flex-1', isEdited ? 'text-[#111827]' : 'text-[#374151]')}>
              {displayText}
            </p>
            {isEdited && (
              <span className="flex-shrink-0 text-[9px] font-semibold text-[#FF8F00] bg-[#FFFDE7] px-1.5 py-0.5 rounded-full mt-0.5">
                edited
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action buttons — visible on hover */}
      {canEdit && !editing && (
        <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded text-[#6B7280] hover:text-[#111827] transition-colors"
            title="Edit segment"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={() => onDelete(segment.id)}
            className="p-1 rounded text-[#6B7280] hover:text-red-500 transition-colors"
            title="Delete segment"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export function TranscriptPanel({ segments, onSeek, sessionId, canEdit, userEmail }: TranscriptPanelProps) {
  const [localSegments, setLocalSegments] = useState<LocalSegment[]>(segments)
  const [saving, setSaving] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [extraEmail, setExtraEmail] = useState('')

  async function patchSegments(updates: { id: string; editedText?: string; isDeleted?: boolean }[]) {
    // Fire-and-forget PATCH — optimistic update already applied to local state
    fetch(`/api/sessions/${sessionId}/transcript`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments: updates }),
    }).catch(console.error)
  }

  function handleSaveSegment(id: string, text: string) {
    setLocalSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, editedText: text } : s)),
    )
    patchSegments([{ id, editedText: text }])
  }

  function handleDelete(id: string) {
    setLocalSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isDeleted: true } : s)),
    )
    patchSegments([{ id, isDeleted: true }])
  }

  function handleRestore(id: string) {
    setLocalSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isDeleted: false } : s)),
    )
    patchSegments([{ id, isDeleted: false }])
  }

  function handleRestoreOriginal(id: string) {
    setLocalSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, editedText: undefined } : s)),
    )
    patchSegments([{ id, editedText: '' }]) // empty string signals "clear edit" to API
  }

  async function handleFinalize() {
    setSaving(true)
    try {
      await fetch(`/api/sessions/${sessionId}/transcript/finalize`, { method: 'POST' })
    } finally {
      setSaving(false)
    }
  }

  async function handleEmail() {
    setEmailing(true)
    setEmailStatus('idle')
    try {
      const body: Record<string, string> = {}
      if (extraEmail.trim()) body.recipientEmail = extraEmail.trim()
      const res = await fetch(`/api/sessions/${sessionId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setEmailStatus(res.ok ? 'sent' : 'error')
    } catch {
      setEmailStatus('error')
    } finally {
      setEmailing(false)
    }
  }

  if (!localSegments.length) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-sm text-[#6B7280]">
        No transcript segments yet.
      </div>
    )
  }

  const activeCount = localSegments.filter((s) => !s.isDeleted).length
  const deletedCount = localSegments.length - activeCount

  return (
    <div className="flex flex-col h-full">
      {/* Segment count */}
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="text-xs text-[#6B7280]">
          {activeCount} segment{activeCount !== 1 ? 's' : ''}
          {deletedCount > 0 && <span className="text-red-400 ml-1">({deletedCount} deleted)</span>}
        </p>
      </div>

      {/* Segments */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 pr-1">
        {localSegments.map((seg) => (
          <SegmentRow
            key={seg.id}
            segment={seg}
            onSeek={onSeek}
            canEdit={canEdit}
            onSave={handleSaveSegment}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onRestoreOriginal={handleRestoreOriginal}
          />
        ))}
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="pt-4 mt-4 border-t border-[#E5E7EB] flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" isLoading={saving} onClick={handleFinalize}>
              Mark as Final
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleEmail}
              disabled={emailing}
              className="gap-1.5"
            >
              {emailing ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
              Email transcript
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-[#6B7280]">
              Sends to {userEmail}
            </p>
            <input
              type="email"
              value={extraEmail}
              onChange={(e) => setExtraEmail(e.target.value)}
              placeholder="Also send to another email (optional)"
              className="text-xs px-2.5 py-1.5 border border-[#E5E7EB] rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#FFD966] w-full"
            />
          </div>
          {emailStatus === 'sent' && (
            <p className="text-xs text-green-600">✓ Transcript sent{extraEmail.trim() ? ` to ${extraEmail.trim()}` : ' to your email'}.</p>
          )}
          {emailStatus === 'error' && (
            <p className="text-xs text-red-500">Failed to send. Please try again.</p>
          )}
        </div>
      )}
    </div>
  )
}
