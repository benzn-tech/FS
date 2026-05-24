import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError, hasMinRole } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'

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

interface ProjectInsight {
  projectId: string
  projectName: string
  keywords: Keyword[]
  issues: Issue[]
  refreshedAt: string
}

interface AggregatedIssue extends Issue {
  projects: { id: string; name: string }[]
  project_count: number
}

// GET /api/organisations/[id]/insights
// Aggregates cached insights from all org projects. Returns top keywords + cross-project issues.
// Accessible to org_admin (their own org) and super_admin (any org).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orgId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()

  const { role, orgId: userOrgId } = session.user

  if (!hasMinRole(role, 'org_admin')) return apiError.forbidden()

  // org_admin can only see their own org
  if (role === 'org_admin' && userOrgId !== orgId) return apiError.forbidden()

  const org = await queryOne<{ id: string; name: string }>(
    'SELECT id, name FROM organisations WHERE id = $1',
    [orgId],
  )
  if (!org) return apiError.notFound('Organisation not found')

  // Fetch all projects in this org that have cached insights
  const projectInsights = await query<{
    project_id: string
    project_name: string
    refreshed_at: string
    keywords: Keyword[]
    issues: Issue[]
  }>(
    `SELECT pi.project_id, p.name AS project_name, pi.refreshed_at, pi.keywords, pi.issues
       FROM project_insights pi
       JOIN projects p ON p.id = pi.project_id
      WHERE p.org_id = $1
        AND pi.keywords != '[]'::jsonb
      ORDER BY pi.refreshed_at DESC`,
    [orgId],
  )

  // Also get all org projects (even those without insights yet)
  const allProjects = await query<{ id: string; name: string }>(
    'SELECT id, name FROM projects WHERE org_id = $1 ORDER BY created_at DESC',
    [orgId],
  )

  const projectsWithInsights: ProjectInsight[] = projectInsights.map((r) => ({
    projectId: r.project_id,
    projectName: r.project_name,
    keywords: r.keywords,
    issues: r.issues,
    refreshedAt: r.refreshed_at,
  }))

  // -------------------------------------------------------------------------
  // Aggregate keywords across all projects
  // -------------------------------------------------------------------------
  const keywordMap: Map<string, { count: number; projects: Set<string>; days: Set<string> }> = new Map()

  for (const pi of projectsWithInsights) {
    for (const kw of pi.keywords) {
      const key = kw.word.toLowerCase()
      const existing = keywordMap.get(key) ?? { count: 0, projects: new Set(), days: new Set() }
      existing.count += kw.count
      existing.projects.add(pi.projectId)
      for (const d of kw.days) existing.days.add(d)
      keywordMap.set(key, existing)
    }
  }

  const aggregatedKeywords = Array.from(keywordMap.entries())
    .map(([word, data]) => ({
      word,
      count: data.count,
      project_count: data.projects.size,
      days: Array.from(data.days).sort().slice(0, 10),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // -------------------------------------------------------------------------
  // Aggregate issues — group by semantic similarity (title keyword match)
  // Issues appearing in 2+ projects are surfaced as cross-project issues.
  // -------------------------------------------------------------------------
  const issueGroups: Map<string, {
    canonical: Issue
    projects: { id: string; name: string }[]
    totalDays: number
  }> = new Map()

  for (const pi of projectsWithInsights) {
    for (const issue of pi.issues) {
      // Build a grouping key from normalised title words
      const titleKey = issue.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 4)
        .sort()
        .join('_')

      if (!titleKey) continue

      const existing = issueGroups.get(titleKey)
      if (existing) {
        // Only add project if not already included
        if (!existing.projects.some((p) => p.id === pi.projectId)) {
          existing.projects.push({ id: pi.projectId, name: pi.projectName })
          existing.totalDays += issue.day_count
          // Escalate severity if this project's instance is worse
          const severityRank = { high: 2, medium: 1, low: 0 }
          if (severityRank[issue.severity] > severityRank[existing.canonical.severity]) {
            existing.canonical.severity = issue.severity
          }
        }
      } else {
        issueGroups.set(titleKey, {
          canonical: { ...issue },
          projects: [{ id: pi.projectId, name: pi.projectName }],
          totalDays: issue.day_count,
        })
      }
    }
  }

  // Surface cross-project issues (2+ projects) sorted by project_count then severity
  const severityRank = { high: 2, medium: 1, low: 0 }
  const crossProjectIssues: AggregatedIssue[] = Array.from(issueGroups.values())
    .filter((g) => g.projects.length >= 2)
    .sort((a, b) => {
      if (b.projects.length !== a.projects.length) return b.projects.length - a.projects.length
      return severityRank[b.canonical.severity] - severityRank[a.canonical.severity]
    })
    .slice(0, 15)
    .map((g) => ({
      ...g.canonical,
      projects: g.projects,
      project_count: g.projects.length,
      day_count: g.totalDays,
    }))

  // Single-project issues (still worth showing per project in the drill-down)
  const singleProjectIssues = Array.from(issueGroups.values())
    .filter((g) => g.projects.length === 1)
    .sort((a, b) => severityRank[b.canonical.severity] - severityRank[a.canonical.severity])
    .slice(0, 20)
    .map((g) => ({
      ...g.canonical,
      projects: g.projects,
      project_count: 1,
      day_count: g.totalDays,
    }))

  return NextResponse.json({
    org: { id: org.id, name: org.name },
    projectCount: allProjects.length,
    analysedCount: projectsWithInsights.length,
    projects: allProjects,
    projectsWithInsights: projectsWithInsights.map((p) => ({
      id: p.projectId,
      name: p.projectName,
      refreshedAt: p.refreshedAt,
      issueCount: p.issues.length,
      keywordCount: p.keywords.length,
    })),
    aggregatedKeywords,
    crossProjectIssues,
    singleProjectIssues,
  })
}
