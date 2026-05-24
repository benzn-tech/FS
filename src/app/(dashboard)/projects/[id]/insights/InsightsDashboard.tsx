'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, RefreshCw, AlertTriangle, ShieldAlert, Wrench, Info } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface Keyword {
  word: string
  count: number
  days: string[]
}

interface Issue {
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
  day_count: number
  example_dates: string[]
}

interface InsightsData {
  keywords: Keyword[]
  issues: Issue[]
  refreshedAt: string
  cached: boolean
  noContent?: boolean
}

// ---------------------------------------------------------------------------
// Colour palette for pie chart slices
// ---------------------------------------------------------------------------
const SLICE_COLOURS = [
  '#FF8F00', '#FFD966', '#3B82F6', '#10B981', '#8B5CF6',
  '#F43F5E', '#06B6D4', '#F59E0B', '#6366F1', '#14B8A6',
  '#EC4899', '#84CC16', '#EF4444', '#A855F7', '#0EA5E9',
]

// ---------------------------------------------------------------------------
// SVG Pie Chart
// ---------------------------------------------------------------------------
function PieChart({ keywords, highlightWord }: {
  keywords: Keyword[]
  highlightWord: string | null
}) {
  const total = keywords.reduce((s, k) => s + k.count, 0)
  if (total === 0 || keywords.length === 0) return null

  const cx = 120
  const cy = 120
  const r = 100

  // Build slices
  let angle = -Math.PI / 2
  const slices = keywords.map((k, i) => {
    const pct = k.count / total
    const startAngle = angle
    const endAngle = angle + pct * 2 * Math.PI
    angle = endAngle

    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = pct > 0.5 ? 1 : 0

    const midAngle = (startAngle + endAngle) / 2
    const labelR = r * 0.65
    const lx = cx + labelR * Math.cos(midAngle)
    const ly = cy + labelR * Math.sin(midAngle)

    return {
      key: k.word,
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      colour: SLICE_COLOURS[i % SLICE_COLOURS.length],
      pct,
      lx,
      ly,
      midAngle,
    }
  })

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[240px] mx-auto">
      {slices.map((s) => {
        const isHighlighted = highlightWord === s.key
        const isDimmed = highlightWord !== null && !isHighlighted
        return (
          <path
            key={s.key}
            d={s.path}
            fill={s.colour}
            opacity={isDimmed ? 0.3 : 1}
            stroke="white"
            strokeWidth={isHighlighted ? 3 : 1.5}
            style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
          />
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Keyword legend row
// ---------------------------------------------------------------------------
function KeywordRow({ keyword, colour, isHighlighted, onHover }: {
  keyword: Keyword
  colour: string
  isHighlighted: boolean
  onHover: (word: string | null) => void
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-colors ${
        isHighlighted ? 'bg-[#F9FAFB]' : 'hover:bg-[#F9FAFB]'
      }`}
      onMouseEnter={() => onHover(keyword.word)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: colour }} />
      <span className="flex-1 text-xs text-[#374151] font-medium truncate">{keyword.word}</span>
      <span className="text-[10px] text-[#9CA3AF] flex-shrink-0">{keyword.count}×</span>
      <span className="text-[10px] text-[#9CA3AF] flex-shrink-0">{keyword.days.length}d</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Issue card
// ---------------------------------------------------------------------------
const SEVERITY_CONFIG = {
  high: {
    label: 'High',
    classes: 'bg-red-50 text-red-700 border-red-200',
    icon: ShieldAlert,
    border: 'border-l-red-400',
  },
  medium: {
    label: 'Medium',
    classes: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: AlertTriangle,
    border: 'border-l-orange-400',
  },
  low: {
    label: 'Low',
    classes: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Info,
    border: 'border-l-blue-400',
  },
}

function IssueCard({ issue }: { issue: Issue }) {
  const cfg = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.medium
  const Icon = cfg.icon

  return (
    <div className={`border border-[#E5E7EB] border-l-4 ${cfg.border} rounded-lg p-4 flex flex-col gap-2`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Icon size={15} className={`flex-shrink-0 mt-0.5 ${
            issue.severity === 'high' ? 'text-red-500' : issue.severity === 'medium' ? 'text-orange-500' : 'text-blue-500'
          }`} />
          <p className="text-sm font-semibold text-[#111827] leading-snug">{issue.title}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${cfg.classes}`}>
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-[#6B7280] leading-relaxed pl-5">{issue.description}</p>
      <div className="pl-5 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-medium text-[#374151]">
          Mentioned on <strong>{issue.day_count}</strong> day{issue.day_count !== 1 ? 's' : ''}
        </span>
        {issue.example_dates.length > 0 && (
          <span className="text-[10px] text-[#9CA3AF]">
            e.g. {issue.example_dates.slice(0, 3).join(', ')}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard component
// ---------------------------------------------------------------------------
export function InsightsDashboard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [hoveredKeyword, setHoveredKeyword] = useState<string | null>(null)

  async function load(refresh = false) {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const url = `/api/projects/${projectId}/insights${refresh ? '?refresh=1' : ''}`
      const res = await fetch(url)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Failed to load insights')
        return
      }
      const d = await res.json()
      setData(d)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-16 justify-center text-sm text-[#6B7280]">
        <Loader2 size={18} className="animate-spin" />
        Analysing transcripts with AI — this may take a moment…
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-red-500 mb-3">{error}</p>
        <button
          onClick={() => load()}
          className="text-xs text-[#6B7280] hover:text-[#111827] border border-[#E5E7EB] rounded px-3 py-1.5 transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!data || data.noContent) {
    return (
      <Card>
        <div className="py-12 text-center">
          <Wrench className="mx-auto mb-3 text-[#D1D5DB]" size={36} />
          <p className="text-sm font-medium text-[#374151]">No transcripts yet</p>
          <p className="text-xs text-[#9CA3AF] mt-1">Insights will appear once recordings have been transcribed.</p>
        </div>
      </Card>
    )
  }

  const { keywords, issues, refreshedAt, cached } = data
  const refreshedDate = new Date(refreshedAt)
  const refreshedLabel = refreshedDate.toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const issuesByGroup = {
    high: issues.filter((i) => i.severity === 'high'),
    medium: issues.filter((i) => i.severity === 'medium'),
    low: issues.filter((i) => i.severity === 'low'),
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Meta bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#9CA3AF]">
          {cached ? 'Cached analysis' : 'Fresh analysis'} · Last updated {refreshedLabel}
        </p>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] border border-[#E5E7EB] rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Keyword section */}
      {keywords.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[#111827] mb-4">Keyword Frequency</h2>
          <div className="flex gap-6 items-start flex-wrap">
            {/* Pie chart */}
            <div className="flex-shrink-0 w-60">
              <PieChart keywords={keywords} highlightWord={hoveredKeyword} />
            </div>
            {/* Legend */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-4 px-2 pb-1 border-b border-[#E5E7EB] mb-1">
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider flex-1">Keyword</span>
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-6 text-right">Hits</span>
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-6 text-right">Days</span>
              </div>
              {keywords.map((k, i) => (
                <KeywordRow
                  key={k.word}
                  keyword={k}
                  colour={SLICE_COLOURS[i % SLICE_COLOURS.length]}
                  isHighlighted={hoveredKeyword === k.word}
                  onHover={setHoveredKeyword}
                />
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Recurring issues section */}
      {issues.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[#111827] mb-1">Recurring Issues</h2>
          <p className="text-xs text-[#9CA3AF] mb-4">
            Problems identified across multiple days on this project.
          </p>
          <div className="flex flex-col gap-3">
            {issuesByGroup.high.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">High severity</p>
                {issuesByGroup.high.map((issue, i) => <IssueCard key={i} issue={issue} />)}
              </div>
            )}
            {issuesByGroup.medium.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider">Medium severity</p>
                {issuesByGroup.medium.map((issue, i) => <IssueCard key={i} issue={issue} />)}
              </div>
            )}
            {issuesByGroup.low.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Low severity</p>
                {issuesByGroup.low.map((issue, i) => <IssueCard key={i} issue={issue} />)}
              </div>
            )}
          </div>
        </Card>
      )}

      {keywords.length === 0 && issues.length === 0 && (
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm text-[#6B7280]">No patterns identified yet. More recordings will improve the analysis.</p>
          </div>
        </Card>
      )}
    </div>
  )
}
