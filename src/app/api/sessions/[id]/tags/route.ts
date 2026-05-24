import { withAuth, apiError } from '@/lib/api-helpers'
import { queryOne, query } from '@/lib/db'
import { invokeBedrockText, parseBedrockJson } from '@/lib/reports'
import { NextResponse } from 'next/server'

interface AiTags {
  trades: string[]
  actions: string[]
  topics: string[]
}

// POST /api/sessions/[id]/tags
// Generates AI metadata tags for a session from its transcript using Bedrock.
export const POST = withAuth(
  async (req, session, { params }) => {
    const id = (params as { id: string }).id
    const orgId = session.user.orgId
    const isInternal = session.user.role === 'org_admin' || session.user.role === 'super_admin'

    const sessionRow = await queryOne<{ id: string; org_id: string; status: string }>(
      isInternal
        ? 'SELECT id, org_id, status FROM sessions WHERE id = $1'
        : 'SELECT id, org_id, status FROM sessions WHERE id = $1 AND org_id = $2',
      isInternal ? [id] : [id, orgId],
    )
    if (!sessionRow) return apiError.notFound('Session not found')

    const segments = await query<{ text: string }>(
      `SELECT COALESCE(edited_text, original_text) AS text
         FROM transcript_segments
        WHERE session_id = $1
          AND (is_deleted IS NOT TRUE)
        ORDER BY segment_index ASC`,
      [id],
    )

    if (segments.length === 0) {
      return apiError.badRequest('No transcript available for this session')
    }

    const transcriptText = segments.map((s) => s.text).join('\n')

    const prompt = `Analyze this construction site transcript and extract metadata tags.
Return ONLY valid JSON in this exact format, with no extra text:
{
  "trades": [],
  "actions": [],
  "topics": []
}

trades must only include values from: steel, electrical, plumbing, concreting, carpentry, painting, civil, mechanical, facades, landscaping
actions must only include values from: RFI, defect, safety_issue, milestone, delay, instruction, approval
topics: 2-5 short topic phrases clearly supported by the transcript (e.g. "concrete pour", "scaffold inspection")

Only include values that are clearly supported by the transcript content.

TRANSCRIPT:
${transcriptText}`

    try {
      const raw = await invokeBedrockText(prompt, 512)
      const tags = parseBedrockJson<AiTags>(raw)

      await query(
        'UPDATE sessions SET ai_tags = $1::jsonb, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(tags), id],
      )

      return NextResponse.json({ ok: true, tags })
    } catch (err) {
      console.error('Bedrock tag generation failed:', err)
      return apiError.serverError('Failed to generate tags')
    }
  },
  { minRole: 'editor' },
)
