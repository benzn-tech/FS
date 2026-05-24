export type Role =
  | 'viewer'
  | 'editor'
  | 'editor_plus'
  | 'site_admin'
  | 'org_admin'
  | 'super_admin'

export type SessionStatus =
  | 'INGESTED'
  | 'TRANSCRIBING'
  | 'READY'
  | 'EXPORTED'
  | 'FAILED'

export interface Organisation {
  id: string
  name: string
  aconexApiKey?: string
  aconexProjectId?: string
  safebaseApiKey?: string
  safebaseWorkspaceId?: string
  transcriptionLanguage: string
  createdAt: string
}

export interface User {
  id: string
  orgId: string
  email: string
  name?: string
  role: Role
  createdAt: string
}

export interface Session {
  id: string
  orgId: string
  userId: string
  title?: string
  recordedAt: string
  durationSeconds?: number
  s3VideoKey?: string
  s3TranscriptKey?: string
  status: SessionStatus
  errorMessage?: string
  retryCount: number
  createdAt: string
  updatedAt: string
}

export interface TranscriptSegment {
  id: string
  sessionId: string
  startSecs: number
  endSecs: number
  speaker?: string
  originalText: string
  editedText?: string
  isFinal: boolean
  createdAt: string
}

export interface ExportLog {
  id: string
  sessionId: string
  platform: 'aconex' | 'safebase'
  exportedBy: string
  exportedAt: string
  status: 'success' | 'failed'
  errorMessage?: string
}

export interface SiteContent {
  id: string
  pageSlug: string
  key: string
  value?: string
  mediaUrl?: string
  updatedAt: string
  updatedBy?: string
}
