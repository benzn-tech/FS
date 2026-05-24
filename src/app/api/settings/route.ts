import { withAuth, apiError } from '@/lib/api-helpers'
import { queryOne, query } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/settings — fetch org settings
export const GET = withAuth(async (req, session) => {
  const row = await queryOne<{
    id: string; name: string; transcribe_language: string
    aconex_config: { api_key?: string; project_id?: string; document_type?: string } | null
    safebase_config: { api_key?: string; workspace_id?: string } | null
    created_at: string
  }>(
    'SELECT id, name, transcribe_language, aconex_config, safebase_config, created_at FROM organisations WHERE id = $1',
    [session.user.orgId],
  )
  if (!row) return apiError.notFound('Organisation not found')

  return NextResponse.json({
    data: {
      id: row.id,
      name: row.name,
      transcriptionLanguage: row.transcribe_language,
      aconexApiKey: row.aconex_config?.api_key ?? '',
      aconexProjectId: row.aconex_config?.project_id ?? '',
      aconexDocumentType: row.aconex_config?.document_type ?? '',
      safebaseApiKey: row.safebase_config?.api_key ?? '',
      safebaseWorkspaceId: row.safebase_config?.workspace_id ?? '',
      createdAt: row.created_at,
    },
  })
})

// PATCH /api/settings — update org settings
export const PATCH = withAuth(
  async (req, session) => {
    const body = await req.json()
    const {
      name,
      transcriptionLanguage,
      aconexApiKey,
      aconexProjectId,
      aconexDocumentType,
      safebaseApiKey,
      safebaseWorkspaceId,
    } = body as Record<string, string | undefined>

    // Build aconex_config and safebase_config as JSONB patches
    // Only update fields that were explicitly provided
    const updates: string[] = []
    const values: unknown[] = []
    let i = 1

    if (name !== undefined) {
      updates.push(`name = $${i++}`)
      values.push(name)
    }
    if (transcriptionLanguage !== undefined) {
      updates.push(`transcribe_language = $${i++}`)
      values.push(transcriptionLanguage)
    }
    if (aconexApiKey !== undefined || aconexProjectId !== undefined || aconexDocumentType !== undefined) {
      // Merge into existing JSONB — coalesce existing config then overlay new values
      updates.push(`aconex_config = aconex_config || $${i++}::jsonb`)
      const patch: Record<string, string> = {}
      if (aconexApiKey !== undefined) patch.api_key = aconexApiKey
      if (aconexProjectId !== undefined) patch.project_id = aconexProjectId
      if (aconexDocumentType !== undefined) patch.document_type = aconexDocumentType
      values.push(JSON.stringify(patch))
    }
    if (safebaseApiKey !== undefined || safebaseWorkspaceId !== undefined) {
      updates.push(`safebase_config = safebase_config || $${i++}::jsonb`)
      const patch: Record<string, string> = {}
      if (safebaseApiKey !== undefined) patch.api_key = safebaseApiKey
      if (safebaseWorkspaceId !== undefined) patch.workspace_id = safebaseWorkspaceId
      values.push(JSON.stringify(patch))
    }

    if (updates.length === 0) return apiError.badRequest('No fields provided to update')

    values.push(session.user.orgId)
    await query(
      `UPDATE organisations SET ${updates.join(', ')} WHERE id = $${i}`,
      values,
    )

    return NextResponse.json({ ok: true })
  },
  { minRole: 'editor_plus' },
)
