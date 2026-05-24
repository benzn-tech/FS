'use client'

import { useState, useEffect } from 'react'
import { Loader2, ShieldAlert, AlertTriangle, Info, ExternalLink, BarChart2, Wrench } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

interface AggregatedKeyword {
  word: string
  count: number
  project_count: number
  days: string[]
}

interface AggregatedIssue {
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
  day_count: number
  example_dates: string[]
  projects: { id: string; name: string }[]
  project_count: number
}

interface ProjectSummary {
  id: string
  name: string
  refreshedAt: string
  issueCount: number
  keywordCount: number
}

interface OrgInsightsData {
  org: { id: string; name: string }
  projectCount: number
  analysedCount: number
  projectsWithInsights: ProjectSummary[]
  projects: { id: string; name: string }[]
  aggregatedKeywords: AggregatedKeyword[]
  crossProjectIssues: AggregatedIssue[]
  singleProjectIssues: AggregatedIssue[]
}

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------
const SLICE_COLOURS = [
  '#FF8F00', '#FFD966', '#3B82F6', '#10B981', '#8B5CF6',
  '#F43F5E', '#06B6D4', '#F59E0B', '#6366F1', '#14B8A6',
  '#EC4899', '#84CC16', '#EF4444', '#A855F7', '#0EA5E9',
]

// ---------------------------------------------------------------------------
// SVG Pie Chart (reused from project insights)
// ---------------------------------------------------------------------------
function PieChart({ items, highlightWord }: {
  items: { word: string; count: number }[]
  highlightWord: string | null
}) {
  const total = items.reduce((s, k) => s + k.count, 0)
  if (total === 0 || items.length === 0) return null

  const cx = 120; const cy = 120; const r = 100
  let angle = -Math.PI / 2
  const slices = items.map((k, i) => {
    const pct = k.count / total
    const startAngle = angle
    const endAngle = angle + pct * 2 * Math.PI
    angle = endAngle
    const x1 = cx + r * Math.cos(startAngle); const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle); const y2 = cy + r * Math.sin(endAngle)
    return {
      key: k.word,
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`,
      colour: SLICE_COLOURS[i % SLICE_COLOURS.length],
    }
  })

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[220px] mx-auto">
      {slices.map((s) => {
        const isHighlighted = highlightWord === s.key
        const isDimmed = highlightWord !== null && !isHighlighted
        return (
          <path key={s.key} d={s.path} fill={s.colour}
            opacity={isDimmed ? 0.3 : 1} stroke="white"
            strokeWidth={isHighlighted ? 3 : 1.5}
            style={{ transition: 'opacity 0.2s' }}
          />
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Severity config
// ---------------------------------------------------------------------------
const SEVERITY_CONFIG = {
  high: { label: 'High', classes: 'bg-red-50 text-red-700 border-red-200', icon: ShieldAlert, border: 'border-l-red-400', colour: 'text-red-500' },
  medium: { label: 'Medium', classes: 'bg-orange-50 text-orange-700 border-orange-200', icon: AlertTriangle, border: 'border-l-orange-400', colour: 'text-orange-500' },
  low: { label: 'Low', classes: 'bg-blue-50 text-blue-700 border-blue-200', icon: Info, border: 'border-l-blue-400', colour: 'text-blue-500' },
}

// ---------------------------------------------------------------------------
// Aggregated issue card — shows which projects it appears in
// ---------------------------------------------------------------------------
function AggIssueCard({ issue }: { issue: AggregatedIssue }) {
  const cfg = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.medium
  const Icon = cfg.icon

  return (
    <div className={`border border-[#E5E7EB] border-l-4 ${cfg.border} rounded-lg p-4 flex flex-col gap-2`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Icon size={15} className={`flex-shrink-0 mt-0.5 ${cfg.colour}`} />
          <p className="text-sm font-semibold text-[#111827] leading-snug">{issue.title}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${cfg.classes}`}>
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-[#6B7280] leading-relaxed pl-5">{issue.description}</p>
      <div className="pl-5 flex flex-col gap-1.5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-medium text-[#374151]">
            Across <strong>{issue.project_count}</strong> project{issue.project_count !== 1 ? 's' : ''}
            {' · '}
            <strong>{issue.day_count}</strong> total day{issue.day_count !== 1 ? 's' : ''}
          </span>
        </div>
        {/* Project links */}
        <div className="flex flex-wrap gap-1.5">
          {issue.projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}/insights`}
              className="inline-flex items-center gap-1 text-[10px] text-[#6B7280] hover:text-[#FF8F00] transition-colors border border-[#E5E7EB] rounded px-1.5 py-0.5"
            >
              {p.name}
              <ExternalLink size={9} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function OrgInsightsDashboard({ orgId }: { orgId: string }) {
  const [data, setData] = useState<OrgInsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredKeyword, setHoveredKeyword] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/organisations/${orgId}/insights`)
      .then((r) => r.ok ? r.json() : r.json().then((d) => Promise.reject(d.error ?? 'Failed')))
      .then(setData)
      .catch((e) => setError(typeof e === 'string' ? e : 'Failed to load insights'))
      .finally(() => setLoading(false))
  }, [orgId])

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-16 justify-center text-sm text-[#6B7280]">
        <Loader2 size={18} className="animate-spin" />
        Aggregating insights across projects…
      </div>
    )
  }

  if (error) {
    return <div className="py-10 text-center text-sm text-red-500">{error}</div>
  }

  if (!data) return null

  const { projectCount, analysedCount, aggregatedKeywords, crossProjectIssues, singleProjectIssues, projectsWithInsights, projects } = data

  const unanalysedProjects = projects.filter(
    (p) => !projectsWithInsights.some((pi) => pi.id === p.id),
  )

  const issuesByGroup = {
    high: crossProjectIssues.filter((i) => i.severity === 'high'),
    medium: crossProjectIssues.filter((i) => i.severity === 'medium'),
    low: crossProjectIssues.filter((i) => i.severity === 'low'),
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Coverage summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm">
          <p className="text-xs text-[#9CA3AF] mb-1">Total projects</p>
          <p className="text-2xl font-bold text-[#111827]">{projectCount}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-[#9CA3AF] mb-1">Projects analysed</p>
          <p className="text-2xl font-bold text-[#111827]">{analysedCount}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-[#9CA3AF] mb-1">Cross-project issues</p>
          <p className="text-2xl font-bold text-[#111827]">{crossProjectIssues.length}</p>
        </Card>
      </div>

      {/* No insights yet */}
      {analysedCount === 0 && (
        <Card>
          <div className="py-12 text-center">
            <Wrench className="mx-auto mb-3 text-[#D1D5DB]" size={36} />
            <p className="text-sm font-medium text-[#374151]">No insights available yet</p>
            <p className="text-xs text-[#9CA3AF] mt-1 mb-4">
              Visit each project's Insights page to generate analysis first.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}/insights`}
                  className="text-xs text-[#6B7280] hover:text-[#FF8F00] border border-[#E5E7EB] rounded px-2.5 py-1 transition-colors inline-flex items-center gap-1"
                >
                  {p.name} <ExternalLink size={10} />
                </Link>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Unanalysed projects notice */}
      {unanalysedProjects.length > 0 && analysedCount > 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-xs text-[#92400E]">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-[#D97706]" />
          <span>
            {unanalysedProjects.length} project{unanalysedProjects.length !== 1 ? 's have' : ' has'} not been analysed yet:{' '}
            {unanalysedProjects.map((p, i) => (
              <span key={p.id}>
                <Link href={`/projects/${p.id}/insights`} className="underline hover:text-[#FF8F00]">{p.name}</Link>
                {i < unanalysedProjects.length - 1 ? ', ' : ''}
              </span>
            ))}.
          </span>
        </div>
      )}

      {/* Aggregated keyword chart */}
      {aggregatedKeywords.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[#111827] mb-1">Top Keywords Across All Projects</h2>
          <p className="text-xs text-[#9CA3AF] mb-4">Combined frequency from {analysedCount} analysed project{analysedCount !== 1 ? 's' : ''}.</p>
          <div className="flex gap-6 items-start flex-wrap">
            <div className="flex-shrink-0 w-56">
              <PieChart
                items={aggregatedKeywords}
                highlightWord={hoveredKeyword}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-4 px-2 pb-1 border-b border-[#E5E7EB] mb-1">
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider flex-1">Keyword</span>
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Hits</span>
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Projects</span>
              </div>
              {aggregatedKeywords.map((k, i) => (
                <div
                  key={k.word}
                  className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-colors ${hoveredKeyword === k.word ? 'bg-[#F9FAFB]' : 'hover:bg-[#F9FAFB]'}`}
                  onMouseEnter={() => setHoveredKeyword(k.word)}
                  onMouseLeave={() => setHoveredKeyword(null)}
                >
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: SLICE_COLOURS[i % SLICE_COLOURS.length] }} />
                  <span className="flex-1 text-xs text-[#374151] font-medium truncate">{k.word}</span>
                  <span className="text-[10px] text-[#9CA3AF] w-8 text-right">{k.count}×</span>
                  <span className="text-[10px] text-[#9CA3AF] w-12 text-right">{k.project_count}p</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Cross-project recurring issues */}
      {crossProjectIssues.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[#111827] mb-1">Issues Across Multiple Projects</h2>
          <p className="text-xs text-[#9CA3AF] mb-4">
            Recurring problems identified in 2 or more projects — click a project to drill down.
          </p>
          <div className="flex flex-col gap-3">
            {issuesByGroup.high.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">High severity</p>
                {issuesByGroup.high.map((issue, i) => <AggIssueCard key={i} issue={issue} />)}
              </div>
            )}
            {issuesByGroup.medium.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider">Medium severity</p>
                {issuesByGroup.medium.map((issue, i) => <AggIssueCard key={i} issue={issue} />)}
              </div>
            )}
            {issuesByGroup.low.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Low severity</p>
                {issuesByGroup.low.map((issue, i) => <AggIssueCard key={i} issue={issue} />)}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Project-level breakdown */}
      {projectsWithInsights.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[#111827] mb-4">Project Breakdown</h2>
          <div className="flex flex-col divide-y divide-[#E5E7EB]">
            {projectsWithInsights.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3 gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#111827] truncate">{p.name}</p>
                  <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                    {p.issueCount} issue{p.issueCount !== 1 ? 's' : ''} · {p.keywordCount} keywords
                  </p>
                </div>
                <Link
                  href={`/projects/${p.id}/insights`}
                  className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#FF8F00] border border-[#E5E7EB] rounded-lg px-2.5 py-1 transition-colors flex-shrink-0"
                >
                  <BarChart2 size={12} />
                  View insights
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
