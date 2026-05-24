export const dynamic = 'force-dynamic'

import { type Metadata } from 'next'
import { auth } from '@/lib/auth'
import { hasMinRole } from '@/lib/api-helpers'
import { queryOne } from '@/lib/db'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ChangePasswordForm } from './ChangePasswordForm'

export const metadata: Metadata = { title: 'Settings' }

const LANGUAGE_OPTIONS = [
  { label: 'English (Australia)', value: 'en-AU' },
  { label: 'English (US)', value: 'en-US' },
  { label: 'English (UK)', value: 'en-GB' },
]

export default async function SettingsPage() {
  const session = await auth()
  const userRole = session?.user.role ?? 'viewer'
  const canEdit = hasMinRole(userRole, 'editor_plus')

  const org = await queryOne<{
    id: string; name: string; transcribe_language: string
    aconex_config: { api_key?: string; project_id?: string; document_type?: string } | null
    safebase_config: { api_key?: string; workspace_id?: string } | null
  }>(
    'SELECT id, name, transcribe_language, aconex_config, safebase_config FROM organisations WHERE id = $1',
    [session?.user.orgId],
  )

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Settings</h1>
        <p className="text-sm text-[#6B7280] mt-1">Organisation and integration configuration</p>
      </div>

      {/* Organisation */}
      <form method="POST" action="/api/settings">
        <Card className="flex flex-col gap-5">
          <h2 className="text-sm font-semibold text-[#111827]">Organisation</h2>
          <Input
            name="name"
            label="Organisation name"
            defaultValue={org?.name ?? ''}
            disabled={!canEdit}
            helperText={canEdit ? undefined : 'Editor+ required to change this.'}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#111827]">Transcription language</label>
            <select
              name="transcriptionLanguage"
              disabled={!canEdit}
              defaultValue={org?.transcribe_language ?? 'en-AU'}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FFD966] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {canEdit && <Button type="submit" className="self-start">Save Changes</Button>}
        </Card>
      </form>

      {/* Aconex */}
      <form method="POST" action="/api/settings">
        <Card className="flex flex-col gap-5">
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">Aconex Integration</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">Export daily diary entries directly to Aconex.</p>
          </div>
          <Input
            name="aconexApiKey"
            label="API Key"
            type="password"
            defaultValue={org?.aconex_config?.api_key ?? ''}
            placeholder="••••••••••••"
            disabled={!canEdit}
          />
          <Input
            name="aconexProjectId"
            label="Project ID"
            defaultValue={org?.aconex_config?.project_id ?? ''}
            placeholder="e.g. 1234567890"
            disabled={!canEdit}
          />
          <Input
            name="aconexDocumentType"
            label="Document Type"
            defaultValue={org?.aconex_config?.document_type ?? ''}
            placeholder="e.g. Daily Diary"
            disabled={!canEdit}
          />
          {canEdit && <Button type="submit" className="self-start">Save Aconex Config</Button>}
        </Card>
      </form>

      {/* Safebase — Southbase Construction only */}
      {org?.name.toLowerCase().includes('southbase') && (
        <form method="POST" action="/api/settings">
          <Card className="flex flex-col gap-5">
            <div>
              <h2 className="text-sm font-semibold text-[#111827]">Safebase Integration</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">Export site diary records to Safebase.</p>
            </div>
            <Input
              name="safebaseApiKey"
              label="API Key"
              type="password"
              defaultValue={org?.safebase_config?.api_key ?? ''}
              placeholder="••••••••••••"
              disabled={!canEdit}
            />
            <Input
              name="safebaseWorkspaceId"
              label="Workspace ID"
              defaultValue={org?.safebase_config?.workspace_id ?? ''}
              placeholder="e.g. ws_abc123"
              disabled={!canEdit}
            />
            {canEdit && <Button type="submit" className="self-start">Save Safebase Config</Button>}
          </Card>
        </form>
      )}

      {/* Change Password */}
      <ChangePasswordForm />
    </div>
  )
}
