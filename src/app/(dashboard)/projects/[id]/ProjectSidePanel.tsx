'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle, CheckSquare, Square, X, Plus, Download, UserCircle, Mail, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type DayTab } from './ProjectDayView'

interface Task {
  id: string
  text: string
  priority: 'high' | 'medium' | 'low'
  done: boolean
  tag: string | null
  assignee_id: string | null
  assignee_name: string | null
}

interface Member {
  user_id: string
  name: string | null
  email: string
}

interface Props {
  projectId: string
  days: DayTab[]
  address: string | null
  latitude?: number | null
  longitude?: number | null
  onSelectDate: (date: string) => void
  selectedDate: string
}

const TRADE_TAGS = [
  'Steel', 'Concrete', 'Electrical', 'Plumbing', 'Carpentry',
  'Roofing', 'Safety', 'Earthworks', 'Painting', 'HVAC', 'Waterproofing', 'General',
]

const TAG_COLOURS: Record<string, string> = {
  Steel: 'bg-slate-100 text-slate-700',
  Concrete: 'bg-stone-100 text-stone-700',
  Electrical: 'bg-yellow-100 text-yellow-700',
  Plumbing: 'bg-blue-100 text-blue-700',
  Carpentry: 'bg-amber-100 text-amber-700',
  Roofing: 'bg-red-100 text-red-700',
  Safety: 'bg-orange-100 text-orange-700',
  Earthworks: 'bg-lime-100 text-lime-700',
  Painting: 'bg-pink-100 text-pink-700',
  HVAC: 'bg-cyan-100 text-cyan-700',
  Waterproofing: 'bg-indigo-100 text-indigo-700',
  General: 'bg-gray-100 text-gray-600',
}

function MiniCalendar({ days, selectedDate, onSelectDate }: {
  days: DayTab[]
  selectedDate: string
  onSelectDate: (date: string) => void
}) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(() => {
    if (days.length > 0) {
      const [y, m] = days[0].date.split('-').map(Number)
      return new Date(y, m - 1, 1)
    }
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthName = viewDate.toLocaleString('default', { month: 'long' })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const blanks = Array(firstDay).fill(null)
  const dayNums = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const recordingDates = new Set(days.map((d) => d.date))

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="p-1 rounded hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-colors"
        >
          <ChevronLeft size={13} />
        </button>
        <span className="text-xs font-semibold text-[#111827]">{monthName} {year}</span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="p-1 rounded hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-colors"
        >
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <span key={i} className="text-[9px] text-center text-[#9CA3AF] font-medium">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {blanks.map((_, i) => <span key={`b${i}`} />)}
        {dayNums.map((day) => {
          const ds = dateStr(day)
          const isToday = ds === today.toISOString().slice(0, 10)
          const hasRecording = recordingDates.has(ds)
          const isSelected = ds === selectedDate

          return (
            <button
              key={day}
              onClick={() => hasRecording && onSelectDate(ds)}
              disabled={!hasRecording}
              className={cn(
                'text-[10px] h-5 w-full rounded text-center transition-colors',
                isSelected
                  ? 'bg-[#FF8F00] text-white font-bold'
                  : isToday && hasRecording
                    ? 'bg-[#FFD966] text-[#111827] font-bold hover:bg-[#FF8F00] hover:text-white'
                    : isToday
                      ? 'bg-[#FFD966] text-[#111827] font-bold'
                      : hasRecording
                        ? 'bg-[#FF8F00]/20 text-[#FF8F00] font-medium hover:bg-[#FF8F00]/40 cursor-pointer'
                        : 'text-[#D1D5DB] cursor-default',
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TaskList({ projectId, date }: { projectId: string; date: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [emailing, setEmailing] = useState(false)
  const [filterMine, setFilterMine] = useState(false)

  // New task form state
  const [showAdd, setShowAdd] = useState(false)
  const [newText, setNewText] = useState('')
  const [newPriority, setNewPriority] = useState<Task['priority']>('medium')
  const [newTag, setNewTag] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/members`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((d) => {
        const rows = d.data ?? d.members ?? []
        setMembers(rows.map((m: { userId?: string; user_id?: string; email: string; name?: string | null }) => ({
          user_id: m.userId ?? m.user_id,
          email: m.email,
          name: m.name ?? null,
        })))
      })
      .catch(() => {})
  }, [projectId])

  useEffect(() => {
    if (!date) return
    setLoading(true)
    setShowAdd(false)
    setExpandedTask(null)
    const url = filterMine
      ? `/api/projects/${projectId}/tasks?date=${date}&assignee=me`
      : `/api/projects/${projectId}/tasks?date=${date}`
    fetch(url)
      .then((res) => res.ok ? res.json() : { tasks: [] })
      .then((data) => setTasks(data.tasks ?? []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [projectId, date, filterMine])

  async function patchTask(taskId: string, fields: Partial<{
    done: boolean; priority: Task['priority']; tag: string | null; assigneeId: string | null
  }>) {
    await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId, ...fields }),
    })
  }

  async function toggleDone(task: Task) {
    const next = !task.done
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: next } : t))
    await patchTask(task.id, { done: next })
  }

  async function setPriority(task: Task, priority: Task['priority']) {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, priority } : t))
    await patchTask(task.id, { priority })
  }

  async function setTag(task: Task, tag: string | null) {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, tag } : t))
    await patchTask(task.id, { tag })
  }

  async function setAssignee(task: Task, assigneeId: string | null) {
    const member = members.find((m) => m.user_id === assigneeId)
    setTasks((prev) => prev.map((t) => t.id === task.id
      ? { ...t, assignee_id: assigneeId, assignee_name: member?.name ?? member?.email ?? null }
      : t
    ))
    await patchTask(task.id, { assigneeId })
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/projects/${projectId}/tasks?taskId=${id}`, { method: 'DELETE' })
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    const text = newText.trim()
    if (!text) return
    setAdding(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks?date=${date}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          priority: newPriority,
          tag: newTag || null,
          assigneeId: newAssignee || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setTasks((prev) => [...prev, data.task])
        setNewText('')
        setNewPriority('medium')
        setNewTag('')
        setNewAssignee('')
        setShowAdd(false)
      }
    } finally {
      setAdding(false)
    }
  }

  async function emailTasks() {
    setEmailing(true)
    try {
      await fetch(`/api/projects/${projectId}/tasks/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date }),
      })
    } finally {
      setEmailing(false)
    }
  }

  function exportCsv() {
    const rows = [
      ['Task', 'Priority', 'Tag', 'Assignee', 'Done', 'Date'],
      ...tasks.map((t) => [
        `"${t.text.replace(/"/g, '""')}"`,
        t.priority,
        t.tag ?? '',
        t.assignee_name ?? '',
        t.done ? 'Yes' : 'No',
        date,
      ]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `action-items-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const priorityStyles: Record<Task['priority'], string> = {
    high: 'text-red-600 bg-red-50 border-red-200',
    medium: 'text-orange-600 bg-orange-50 border-orange-200',
    low: 'text-gray-500 bg-gray-50 border-gray-200',
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest">Action Items</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterMine((v) => !v)}
            title={filterMine ? 'Show all tasks' : 'Show only assigned to me'}
            className={`transition-colors ${filterMine ? 'text-[#FF8F00]' : 'text-[#9CA3AF] hover:text-[#FF8F00]'}`}
          >
            <Filter size={12} />
          </button>
          {tasks.length > 0 && (
            <>
              <button
                onClick={emailTasks}
                disabled={emailing}
                className="text-[#9CA3AF] hover:text-[#FF8F00] transition-colors disabled:opacity-50"
                title="Email action items to me"
              >
                <Mail size={12} />
              </button>
              <button
                onClick={exportCsv}
                className="text-[#9CA3AF] hover:text-[#FF8F00] transition-colors"
                title="Export as CSV"
              >
                <Download size={12} />
              </button>
            </>
          )}
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="text-[#9CA3AF] hover:text-[#FF8F00] transition-colors"
            title="Add task"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {filterMine && (
        <p className="px-3 pb-1 text-[9px] text-[#FF8F00] font-medium">Filtered: assigned to me</p>
      )}

      {loading ? (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-[#F3F4F6] rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {tasks.length === 0 && !showAdd && (
            <p className="px-3 pb-3 text-xs text-[#9CA3AF]">
              {filterMine ? 'No items assigned to you.' : 'No action items for this day.'}
            </p>
          )}

          {tasks.length > 0 && (
            <ul className="px-3 pb-2 flex flex-col gap-1.5">
              {tasks.map((task) => (
                <li key={task.id} className="flex flex-col group">
                  <div className="flex items-start gap-1.5">
                    <button
                      onClick={() => toggleDone(task)}
                      className="flex-shrink-0 mt-0.5 text-[#9CA3AF] hover:text-[#FF8F00] transition-colors"
                    >
                      {task.done
                        ? <CheckSquare size={13} className="text-[#FF8F00]" />
                        : <Square size={13} />}
                    </button>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                    >
                      <p className={`text-xs leading-snug ${task.done ? 'line-through text-[#9CA3AF]' : 'text-[#374151]'}`}>
                        {task.text}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {task.tag && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${TAG_COLOURS[task.tag] ?? 'bg-gray-100 text-gray-600'}`}>
                            {task.tag}
                          </span>
                        )}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${priorityStyles[task.priority]}`}>
                          {task.priority}
                          {task.priority === 'high' && <AlertTriangle size={8} className="inline ml-0.5 mb-0.5" />}
                        </span>
                        {task.assignee_name && (
                          <span className="text-[9px] text-[#6B7280] flex items-center gap-0.5">
                            <UserCircle size={9} />
                            {task.assignee_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-[#9CA3AF] hover:text-red-500 transition-all mt-0.5"
                      title="Delete task"
                    >
                      <X size={11} />
                    </button>
                  </div>

                  {/* Expanded controls */}
                  {expandedTask === task.id && (
                    <div className="ml-5 mt-1.5 mb-1 flex flex-col gap-1.5 p-2 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-[#9CA3AF] w-14 flex-shrink-0">Priority</span>
                        <div className="flex gap-1">
                          {(['high', 'medium', 'low'] as const).map((p) => (
                            <button
                              key={p}
                              onClick={() => setPriority(task, p)}
                              className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium transition-colors ${
                                task.priority === p ? priorityStyles[p] : 'text-[#9CA3AF] bg-white border-[#E5E7EB] hover:border-[#9CA3AF]'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-[#9CA3AF] w-14 flex-shrink-0">Tag</span>
                        <select
                          value={task.tag ?? ''}
                          onChange={(e) => setTag(task, e.target.value || null)}
                          className="flex-1 text-[10px] border border-[#E5E7EB] rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8F00]"
                        >
                          <option value="">None</option>
                          {TRADE_TAGS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      {members.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-[#9CA3AF] w-14 flex-shrink-0">Assign</span>
                          <select
                            value={task.assignee_id ?? ''}
                            onChange={(e) => setAssignee(task, e.target.value || null)}
                            className="flex-1 text-[10px] border border-[#E5E7EB] rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8F00]"
                          >
                            <option value="">Unassigned</option>
                            {members.map((m) => (
                              <option key={m.user_id} value={m.user_id}>
                                {m.name ?? m.email}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Inline add form with priority, tag, assignee */}
          {showAdd && (
            <form onSubmit={addTask} className="px-3 pb-3 flex flex-col gap-2 border-t border-[#E5E7EB] pt-2">
              <input
                autoFocus
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Describe the action item…"
                className="text-xs border border-[#E5E7EB] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#FF8F00] w-full"
              />
              <div className="flex gap-1.5">
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as Task['priority'])}
                  className="flex-1 text-[10px] border border-[#E5E7EB] rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8F00]"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="flex-1 text-[10px] border border-[#E5E7EB] rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8F00]"
                >
                  <option value="">No tag</option>
                  {TRADE_TAGS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {members.length > 0 && (
                <select
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="text-[10px] border border-[#E5E7EB] rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8F00] w-full"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name ?? m.email}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  disabled={adding || !newText.trim()}
                  className="flex-1 text-xs px-2 py-1.5 bg-[#FF8F00] text-white rounded hover:bg-[#E67E00] disabled:opacity-50 transition-colors font-medium"
                >
                  {adding ? 'Adding…' : 'Add item'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="text-xs px-2 py-1.5 text-[#6B7280] hover:text-[#111827] rounded border border-[#E5E7EB] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  )
}

export function ProjectSidePanel({ projectId, days, address, latitude, longitude, selectedDate, onSelectDate }: Props) {
  const mapsUrl = (latitude != null && longitude != null)
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.005},${latitude - 0.005},${longitude + 0.005},${latitude + 0.005}&layer=mapnik&marker=${latitude},${longitude}`
    : address
      ? `https://www.openstreetmap.org/export/embed.html?query=${encodeURIComponent(address)}&layer=mapnik`
      : null

  return (
    <div className="flex flex-col gap-4 w-64 flex-shrink-0">
      {/* Mini calendar */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-3">
        <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Recordings</p>
        <MiniCalendar days={days} selectedDate={selectedDate} onSelectDate={onSelectDate} />
      </div>

      {/* Map */}
      {mapsUrl && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest px-3 pt-2 pb-1">Site Location</p>
          <iframe
            src={mapsUrl}
            width="100%"
            height="200"
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            title="Site location"
          />
        </div>
      )}

      {/* Task list */}
      {selectedDate && <TaskList projectId={projectId} date={selectedDate} />}
    </div>
  )
}
