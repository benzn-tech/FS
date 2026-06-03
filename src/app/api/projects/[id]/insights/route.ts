import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/db'
import { verifyProjectAccess, invokeBedrockText, parseBedrockJson } from '@/lib/reports'

const CACHE_TTL_HOURS = 24

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

// GET /api/projects/[id]/insights
// Returns cached keyword + issue analysis. Regenerates if cache is stale (>24h) or missing.
// Query param: ?refresh=1 to force regeneration.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const session = await auth()
  if (!session?.user) return apiError.unauthorized()

  const { role, orgId, id: userId } = session.user
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'

  const project = await verifyProjectAccess(projectId, role, orgId, userId)
  if (!project) return apiError.notFound('Project not found')

  // Check cache
  const cached = await queryOne<{
    id: string
    refreshed_at: string
    keywords: Keyword[]
    issues: Issue[]
  }>(
    'SELECT id, refreshed_at, keywords, issues FROM project_insights WHERE project_id = $1',
    [projectId],
  )

  const now = Date.now()
  const cacheAge = cached
    ? (now - new Date(cached.refreshed_at).getTime()) / (1000 * 60 * 60)
    : Infinity

  if (cached && cacheAge < CACHE_TTL_HOURS && !forceRefresh) {
    return NextResponse.json({
      keywords: cached.keywords,
      issues: cached.issues,
      refreshedAt: cached.refreshed_at,
      cached: true,
    })
  }

  // Fetch all transcript segments grouped by date
  const segments = await query<{
    date: string
    text: string
  }>(
    `SELECT DATE(s.recorded_at + interval '10 hours')::text AS date,
            ts.original_text AS text
       FROM transcript_segments ts
       JOIN sessions s ON s.id = ts.session_id
      WHERE s.project_id = $1
        AND ts.original_text IS NOT NULL
        AND ts.original_text != ''
      ORDER BY s.recorded_at ASC`,
    [projectId],
  )

  if (segments.length === 0) {
    return NextResponse.json({
      keywords: [],
      issues: [],
      refreshedAt: new Date().toISOString(),
      cached: false,
      noContent: true,
    })
  }

  // Group text by date for the prompt
  const byDate: Record<string, string[]> = {}
  for (const seg of segments) {
    if (!byDate[seg.date]) byDate[seg.date] = []
    byDate[seg.date].push(seg.text)
  }

  const dates = Object.keys(byDate).sort()
  // Truncate to avoid hitting token limits — sample up to 8000 chars per day, max 20 days
  const transcriptBlock = dates.slice(-20).map((d) => {
    const dayText = byDate[d].join(' ').slice(0, 8000)
    return `=== ${d} ===\n${dayText}`
  }).join('\n\n')

  const prompt = `You are an AI analyst for a construction site documentation platform. Analyse the following site transcripts from multiple days and return a JSON report.

Return ONLY valid JSON with this exact structure — no markdown, no extra text:
{
  "keywords": [
    { "word": "keyword or short phrase", "count": 12, "days": ["2026-03-01", "2026-03-02"] }
  ],
  "issues": [
    {
      "title": "Short issue title (max 8 words)",
      "description": "One or two sentences describing the recurring issue and its impact.",
      "severity": "high",
      "day_count": 4,
      "example_dates": ["2026-03-01", "2026-03-03"]
    }
  ]
}

Rules for keywords:
- Extract the top 15 most meaningful and frequently mentioned terms: trade names, materials, locations, activities, equipment, subcontractors, defect types
- STRICT exclusion — never include: filler words (ok, yeah, yep, right, sure, alright, actually, basically, just, like, so, well, now, then, there), pronouns, articles (a, the, an), prepositions, common verbs (is, are, was, have, get, got, go, going, getting, need, want, look, think, know, see, come, put, take, do, done, make), greetings, affirmations, or any word that would appear in normal everyday conversation and carries no construction-specific meaning
- Every keyword must be a specific noun, named entity, technical term, or construction activity — if it could appear in a non-construction conversation, exclude it
- "count" is how many times the keyword appears across all transcripts (approximate)
- "days" lists which dates it appeared on (YYYY-MM-DD)

Rules for issues:
- Identify up to 10 RECURRING problems that appear across multiple days — safety violations, subcontractor non-compliance, scope disagreements, material defects, inspection failures, or repeated work stoppages
- Each issue must appear on at least 2 different days to qualify
- severity: "high" = safety risk or critical defect; "medium" = scope/quality issue; "low" = administrative or minor
- "day_count" = number of distinct days this issue was mentioned
- "example_dates" = up to 3 dates where this issue appears

TRANSCRIPTS:
${transcriptBlock}`

  try {
    const raw = await invokeBedrockText(prompt, 3000)
    const parsed = parseBedrockJson<{ keywords: Keyword[]; issues: Issue[] }>(raw)

    const keywords: Keyword[] = (parsed.keywords ?? [])
      .filter((k) => k.word && k.count > 0)
      .slice(0, 15)

    const issues: Issue[] = (parsed.issues ?? [])
      .filter((i) => i.title && i.description)
      .slice(0, 10)

    // Upsert cache
    await queryOne(
      `INSERT INTO project_insights (project_id, refreshed_at, keywords, issues)
       VALUES ($1, NOW(), $2, $3)
       ON CONFLICT (project_id) DO UPDATE
         SET refreshed_at = NOW(), keywords = $2, issues = $3`,
      [projectId, JSON.stringify(keywords), JSON.stringify(issues)],
    )

    return NextResponse.json({
      keywords,
      issues,
      refreshedAt: new Date().toISOString(),
      cached: false,
    })
  } catch (err) {
    console.error('Insights generation failed:', err)
    // Return stale cache if available rather than erroring
    if (cached) {
      return NextResponse.json({
        keywords: cached.keywords,
        issues: cached.issues,
        refreshedAt: cached.refreshed_at,
        cached: true,
        stale: true,
      })
    }
    return apiError.serverError('Failed to generate insights')
  }
}
