# SPEC.md — FieldSightAI Platform

> Reference document. Read at the start of every session. Architecture, data model, API routes, design system, known gotchas, and outstanding work.

---

## 1. Product Overview

**FieldSightAI** eliminates manual daily diary writing for construction site managers by automatically capturing, transcribing, and distributing footage from RealPTT body cameras.

### Core User Journey
1. Site manager wears a **RealPTT body camera** on site.
2. Footage auto-uploads to RealPTT's cloud platform.
3. FieldSightAI polls RealPTT every 2 min via Lambda + EventBridge.
4. Video is pulled into S3, transcribed via Amazon Transcribe, stored in DB.
5. Site manager logs in, reviews recordings, edits transcript.
6. Finalized transcript is pushed as a daily diary into **Aconex** or **Autodesk Forma**.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Backend / API | Next.js API Routes + AWS Lambda (Python 3.13) |
| Hosting | AWS Amplify SSR — `ap-southeast-2`, app-id: `d19u3207g5s0sc` |
| Video Storage | AWS S3 (`fsai-videos`) |
| Transcription | Amazon Transcribe (speaker diarization enabled) |
| AI Reports | AWS Bedrock (`amazon.nova-pro-v1:0`) — IAM auth, no API key |
| Event Orchestration | AWS EventBridge (`fieldsightai-events` custom bus) |
| Database | Amazon RDS PostgreSQL 16.6 (`fieldsightai` db) — `ap-southeast-2` |
| Auth | Custom JWT (`jose` HS256, httpOnly cookie `fsai_session`, 7-day expiry) |
| Email | AWS SES — `noreply@fieldsightai.com`, `fieldsightai.com` domain verified |
| CI/CD | GitHub → Amplify auto-deploy on push to `main`; Lambdas via SAM CLI |
| Secrets | AWS SSM Parameter Store (Lambda); env vars (Next.js) |

---

## 3. AWS Architecture

### 3.1 Ingest Pipeline

```
RealPTT → EventBridge schedule (every 2 min)
       ↓
Lambda: ingest_video.py
  - RealPTT auth → download → S3 fsai-videos/{org_id}/{session_id}/raw.mp4
  - Upserts session in DB (status: INGESTED). Photos → READY immediately.
       ↓ (S3 PUT triggers EventBridge rule)
Lambda: trigger_transcription.py
  - Starts Amazon Transcribe job → output: fsai-transcripts/{org_id}/{session_id}/transcript.json
  - Status → TRANSCRIBING
       ↓ (EventBridge: Transcribe Job State Change)
Lambda: process_transcript.py
  - Checks duration — recordings < 30s marked SKIPPED (accidental activations), hidden from UI
  - Parses transcript JSON → stores segments in DB, writes duration_secs
  - Status → READY / FAILED / SKIPPED
```

### 3.2 S3 Buckets

| Bucket | Access | Purpose |
|---|---|---|
| `fsai-videos` | Private | Raw RealPTT video/audio/photo files |
| `fsai-transcripts` | Private | Amazon Transcribe output JSON |
| `fsai-media` | Public-read | Project thumbnails, CMS images |

Bucket names use `fsai-*` — `fieldsightai-*` names were already taken. Videos/audio served via **pre-signed GET URLs** (15 min expiry) — raw S3 URLs never exposed.

### 3.3 Lambda Functions

| Function | Trigger | Responsibilities |
|---|---|---|
| `ingest_video.py` | EventBridge schedule + `retry-requested` event | RealPTT poll → S3 upload → session upsert |
| `trigger_transcription.py` | S3 PUT (`.mp4` / `.wav`) | Start Transcribe job, status → TRANSCRIBING |
| `process_transcript.py` | EventBridge (Transcribe complete) | Parse JSON → segments → READY/FAILED/SKIPPED |
| `export_to_aconex.py` | Synchronous Lambda invoke | Format transcript → POST to Aconex → `export_log` |
| `export_to_safebase.py` | Synchronous Lambda invoke | Format transcript → POST to Safebase → `export_log` |

Shared helpers: `lambda/shared/db.py`, `ssm.py`, `realptt.py`. SAM template: `lambda/template.yaml`. Deploy: `sam build && sam deploy` from `lambda/`.

### 3.4 EventBridge Rules

| Rule | Source | Target |
|---|---|---|
| `realptt-poll-schedule` | Schedule (every 2 min) | `ingest_video` |
| `retry-requested` | `fieldsightai.api` | `ingest_video` |
| `fieldsightai-transcribe-job-complete` | `aws.transcribe` (default bus) | `process_transcript` |

### 3.5 Error Handling

- All Lambdas write `status = FAILED` + `error_message` to DB on exceptions.
- SQS DLQs on each Lambda (14-day retention).
- Manual retry: `POST /api/sessions/[id]/retry` — resets to INGESTED, increments `retry_count`, republishes to EventBridge. Max 3 retries.

### 3.6 Monitoring & Alerts ⚠️ PENDING

CloudWatch alarms + SNS not yet configured. Outstanding task — see section 10.

Planned setup (all in `lambda/template.yaml` as CloudFormation resources):
- `AWS::SNS::Topic` — `fieldsightai-alerts` → email subscription
- `AWS::CloudWatch::Alarm` per Lambda — error rate > threshold over 5-min window
- `AWS::CloudWatch::Alarm` per Lambda DLQ — `ApproximateNumberOfMessagesVisible` > 0
- Amplify 5xx alarm — CloudWatch metric filter on Amplify access logs

---

## 4. Data Model

Migrations in `migrations/`. Runner: `node migrations/run-migrations.mjs "<connection-string>"`. All migrations use `IF NOT EXISTS` — safe to re-run.

| Table | Key columns |
|---|---|
| `organisations` | `id, name, transcribe_language, aconex_config (JSONB), safebase_config (JSONB)` |
| `users` | `id, org_id, email, name, role, password_hash, signup_source (self│invited)` |
| `projects` | `id, org_id, name, address, status (active│archived), thumbnail_url, latitude NUMERIC(10,7), longitude NUMERIC(10,7)` |
| `org_devices` | `id, org_id, device_account (UNIQUE), label` |
| `project_devices` | `id, project_id, device_account (UNIQUE), user_id` |
| `project_members` | `project_id, user_id` |
| `sessions` | `id, org_id, user_id, project_id, realptt_id, realptt_account, realptt_user_name, title, recorded_at, duration_secs, video_s3_key, media_type (video│audio│photo), status (INGESTED│TRANSCRIBING│READY│FAILED│SKIPPED), error_message, retry_count, speaker_names JSONB, ai_tags JSONB` |
| `transcript_segments` | `id, session_id, segment_index, start_time, end_time, speaker_label, original_text (immutable), edited_text, is_final` |
| `export_log` | `id, session_id, platform (aconex│safebase), status, exported_at, response_payload (JSONB)` |
| `password_reset_tokens` | `id, user_id, token_hash (SHA-256), expires_at, used_at` — invites: 24h TTL; password resets: 15 min TTL |
| `project_tasks` | `id, project_id, date, text, priority (high│medium│low), tag, assignee_id, done, created_by, created_at` — **project-shared** (no user_id); migration 019 |
| `project_insights` | `id, project_id (UNIQUE), refreshed_at, keywords JSONB, issues JSONB` — Bedrock analysis cache; upserted on demand, 24h TTL |
| `site_content` | `id, page_slug, key, value, media_url, updated_at, updated_by` |

### Device Routing

Two-level hierarchy:
1. **Org level** — `org_devices`: device belongs to one org globally (`device_account` UNIQUE).
2. **Project level** — `project_devices`: device mapped to a project within that org. `ingest_video.py` looks up `device_account → project_id / user_id` on every ingest. No mapping = session is unassigned.

- Reassigning a device only affects **future** ingests.
- `sessions.realptt_account` / `realptt_user_name` are immutable — raw RealPTT identity at ingest time.

---

## 5. Frontend

### 5.1 Routes

```
(marketing)/             — public: home, about, pricing, contact, privacy, terms
(auth)/                  — login, register, forgot-password, reset-password
(dashboard)/
  dashboard/             — projects grid
  organisations/         — super_admin: org list + detail
  organisations/[id]/insights/ — org_admin+ : keyword + cross-project issue aggregation
  devices/               — super_admin: org-level device ownership + project mapping
  projects/[id]/         — day-view: playlist + video + transcript side-by-side, search, AI report, tasks, map
  projects/[id]/settings/ — org_admin+: project details (name/address/GPS), members, devices
  projects/[id]/insights/ — viewer+: keyword pie chart + recurring issues (Bedrock, 24h cache)
  sessions/              — all recordings list
  settings/              — org config, user management (invite, resend invite, roles)
(admin)/                 — super_admin: CMS editor, media uploader
```

### 5.2 API Routes

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | public | Sets `fsai_session` httpOnly JWT cookie |
| POST | `/api/auth/logout` | public | Clears cookie |
| POST | `/api/auth/forgot-password` | public | Rate limited; sends reset email via SES |
| POST | `/api/auth/reset-password` | public | Validates token (15 min TTL), updates password, clears session |
| POST | `/api/auth/resend-invite` | public | Rate limited; resends invite link for unactivated accounts |
| GET/POST | `/api/organisations` | super_admin | |
| PATCH | `/api/organisations/[id]` | super_admin | |
| GET | `/api/organisations/[id]/insights` | org_admin+ | Aggregates cached `project_insights` across all org projects; surfaces cross-project issues (2+ projects) + keyword totals |
| GET/POST | `/api/projects` | viewer+ | Role-scoped |
| GET/PATCH | `/api/projects/[id]` | viewer+ | PATCH name/address/lat/lng: org_admin+; PATCH status: super_admin only |
| POST | `/api/projects/[id]/thumbnail` | site_admin+ | Pre-signed S3 PUT URL |
| GET/POST | `/api/projects/[id]/members` | site_admin+ | |
| DELETE | `/api/projects/[id]/members/[userId]` | site_admin+ | |
| POST | `/api/projects/[id]/members/invite` | super_admin | Create user + add to project + send invite |
| GET/POST | `/api/projects/[id]/devices` | org_admin+ | Lowered from super_admin |
| DELETE | `/api/projects/[id]/devices/[deviceId]` | org_admin+ | Lowered from super_admin |
| GET | `/api/projects/[id]/day-sessions` | viewer+ | Sessions + segments + signed URLs for `?date=YYYY-MM-DD`; excludes SKIPPED |
| GET | `/api/projects/[id]/search` | viewer+ | ILIKE across transcript segments; `?q=`; max 50 results |
| GET/POST/PATCH/DELETE | `/api/projects/[id]/tasks` | viewer+ | **Project-shared** task list; GET auto-seeds via Bedrock (once per project+date), `?assignee=me` filter; POST accepts `tag`, `priority`, `assigneeId` upfront; PATCH any member; DELETE creator or site_admin+ |
| POST | `/api/projects/[id]/tasks/email` | viewer+ | Email today's action items to self |
| GET | `/api/projects/[id]/insights` | viewer+ | Bedrock keyword + recurring issue analysis; cached in `project_insights` (24h); `?refresh=1` forces regeneration; returns stale cache on Bedrock error |
| POST | `/api/projects/[id]/report` | viewer+ | Bedrock AI daily report; includes Open-Meteo weather if project has lat/lng |
| POST | `/api/projects/[id]/report/email` | viewer+ | Generate + email report (includes weather) |
| GET/POST | `/api/devices` | super_admin | Org-level device list / add |
| PATCH | `/api/devices/[account]` | super_admin | Update label, move org, assign project + user |
| DELETE | `/api/devices/[account]` | super_admin | Remove from org + clears project mapping |
| GET | `/api/sessions` | viewer+ | Org-scoped; excludes SKIPPED |
| GET/PATCH | `/api/sessions/[id]` | viewer+ | PATCH: reassign project/user (site_admin+) |
| GET/PATCH | `/api/sessions/[id]/transcript` | editor+ | `edited_text` only — `original_text` immutable; caller must be a project member (or site_admin+) |
| POST | `/api/sessions/[id]/transcript/finalize` | editor+ | Sets `is_final=true` |
| PATCH | `/api/sessions/[id]/speakers` | editor+ | `{ spk_0: "Name", ... }` → `speaker_names` JSONB |
| POST | `/api/sessions/[id]/tags` | editor+ | Bedrock AI tags → `ai_tags` JSONB |
| POST | `/api/sessions/[id]/email` | viewer+ | Email transcript via SES |
| POST | `/api/sessions/[id]/export` | editor+ | Invoke export Lambda |
| GET | `/api/sessions/[id]/video-url` | viewer+ | Pre-signed GET URL (15 min) |
| POST | `/api/sessions/[id]/retry` | site_admin+ | Reset → INGESTED, republish to EventBridge |
| GET/POST | `/api/users` | site_admin+ | |
| POST | `/api/users/invite` | site_admin+ | Create user + send invite email (24h token); rate limited (10/hr) |
| PATCH/DELETE | `/api/users/[id]` | site_admin+ | |
| POST | `/api/users/[id]/resend-invite` | site_admin+ | Invalidate old tokens + resend; rate limited (10/hr) |
| POST | `/api/users/change-password` | viewer+ | Change own password — verifies current password |
| GET/PATCH | `/api/settings` | viewer+ | Org config |
| POST | `/api/contact` | public | Rate limited (10/hr); sends to `CONTACT_EMAIL` via SES |
| GET/PATCH | `/api/admin/content` | super_admin | CMS |
| POST | `/api/admin/media` | super_admin | Upload to `fsai-media` |
| POST | `/api/webhooks/realptt` | HMAC | HMAC-SHA256 validated → EventBridge |

### 5.3 Role-Based Access Control

| Role | Scope | Key permissions |
|---|---|---|
| `viewer` | Customer | Read-only |
| `editor` | Customer | Edit transcripts, trigger exports |
| `editor_plus` | Customer | + org settings, integration config |
| `site_admin` | Customer org | + invite/remove users (up to editor_plus) |
| `org_admin` | FieldSightAI internal | All customer orgs; edit project name/address/GPS/members/devices; org insights; no CMS |
| `super_admin` | FieldSightAI internal | Full access, assign any role, project status changes |

### 5.4 Design System

Custom components only — no UI kit. Tailwind v4 with `@theme` CSS variables. `cn()` via `clsx` + `tailwind-merge`.

| Token | Value |
|---|---|
| Brand yellow | `#FFD966` (hover: `#F5CC55`), always paired with dark text `#111827` |
| Background | `#FFFFFF` / `#F9FAFB` |
| Text primary | `#111827` |
| Text secondary | `#6B7280` |
| Border | `#E5E7EB` |
| Danger | `#EF4444` |
| Sidebar bg | `#111827` |

---

## 6. RealPTT Integration

- **Auth:** `GET /ptt/random` → `HMAC-SHA1(message=random, key=SHA1(password))` → login → `jsessionid` cookie. Inject as `;jsessionid=XXX` **before** `?` in all subsequent URLs.
- **Ingest endpoint:** `/ptt/uploadFile` per user account (NOT `/ptt/video` — returns nothing).
- **Date params:** Both `start_time` AND `end_time` are required — omitting either returns API error 1 "date format error". Format: `"YYYY-MM-DD"` (date only, NZ local time UTC+12). Sending a full datetime string also causes the error.
- **Login timezone:** `timeZoneOffset=-480` (UTC+8). Dates must be sent in NZ local time (UTC+12) regardless — matching the working coworker integration.
- **Media types:** `.mp4` (video), `.wav` (audio), `.jpg` (photo). Photos skip transcription → READY immediately.
- **Dedup key:** `file_name` field (e.g. `2026-03-20-12-18-34`) stored as `realptt_id`.
- **File expiry:** RealPTT retains files ~2–3 weeks. `502 Bad Gateway` = expired — silent skip.
- **Session expiry:** `code=1001` in response → auto-relogin.
- **Credentials:** SSM — `/fieldsightai/realptt_account`, `/fieldsightai/realptt_password` (plain String, not SecureString).
- **Accounts polled:** `Benl1`–`Benl7` (via `REALPTT_USER_ACCOUNTS` Lambda env var).
- **Full API reference:** `REAL PTT API document.txt` in repo root.

---

## 7. Email (AWS SES)

All SES logic in `src/lib/email.ts`. Client created per-request via `makeSESClient()` — never module-level (Amplify injects credentials at request time).

**Sender:** `noreply@fieldsightai.com` — `fieldsightai.com` domain verified in SES, production access granted, `ses:SendEmail` + `ses:SendRawEmail` on `fieldsightai-app-policy`.

| Function | Trigger |
|---|---|
| `sendInviteEmail` | User invited (24h link) or resend invite |
| `sendPasswordResetEmail` | Forgot password (15 min link) |
| `sendWelcomeEmail` | Self-registration — includes login link + "what to expect" |
| `sendTranscriptEmail` | User emails transcript from session view |
| `sendReportEmail` | User emails AI daily report |
| `sendContactEmail` | Contact form → `CONTACT_EMAIL` env var |

**SES is in production mode** (not sandbox). `josh.wild@southbase.co.nz` does not receive SES emails — suspected Southbase DMARC/inbound filtering. Use a Gmail or `preformance.co.nz` address for testing.

**Pending:** MAIL FROM `mail.fieldsightai.com` DNS records need adding at Discount Domains. `CONTACT_EMAIL` should be updated to `contact@fieldsightai.com` once inbox is set up (IT).

---

## 8. Environment Variables

Amplify Console env vars → written to `.env.production` at build time via `amplify.yml`:

`DATABASE_URL`, `APP_SECRET`, `APP_URL`, `AWS_REGION`, `S3_VIDEOS_BUCKET`, `S3_TRANSCRIPTS_BUCKET`, `S3_MEDIA_BUCKET`, `EVENTBRIDGE_BUS_NAME`, `REALPTT_WEBHOOK_SECRET`, `ACONEX_BASE_URL`, `SAFEBASE_BASE_URL`, `APP_AWS_ACCESS_KEY_ID`, `APP_AWS_SECRET_ACCESS_KEY`, `CONTACT_EMAIL`

**Lambda secrets (SSM):** `/fieldsightai/realptt_account`, `/fieldsightai/realptt_password`, `/fieldsightai/db_connection_string`

---

## 9. Security

### Auth & Access Control
- All protected routes use `withAuth()` — enforces JWT session, returns 401 if missing
- Role hierarchy enforced via `ROLE_HIERARCHY` in `src/lib/roles.ts`
- Transcript GET/PATCH: caller must be a `project_members` entry for the session's project, unless `site_admin+`
- Project members GET: org_id check enforced — `site_admin` can only view members within their own org
- All SQL queries use parameterized statements — no SQL injection risk

### CORS
- Handled in `src/proxy.ts` (Amplify's middleware equivalent) — dynamically echoes back the matched single origin (not comma-joined)
- Allowed origins: `https://fieldsightai.com`, `https://main.d19u3207g5s0sc.amplifyapp.com` (prod); `http://localhost:3000` (dev)
- Unrecognised origins receive no `Access-Control-Allow-Origin` header

### Rate Limiting
In-memory sliding-window limiter (`src/lib/rate-limit.ts`). Resets on cold start — sufficient for single-instance serverless. Swap store for Upstash Redis for cross-instance limiting if needed.

| Limiter | Endpoints | Limit |
|---|---|---|
| `limits.auth` | login, forgot-password, reset-password, resend-invite, registration | 10 / 15 min |
| `limits.passwordReset` | reset-password | 5 / hr |
| `limits.email` | contact, invite, resend-invite | 10 / hr |
| `limits.export` | session export | 20 / min |
| `limits.api` | general API | 100 / min |
| `limits.webhook` | RealPTT webhook | 60 / min |

### Password Policy
- Minimum 8 characters — enforced on registration, reset, change-password (client + server)
- No maximum length, no character restrictions — bcrypt accepts raw bytes
- Passwords never sanitized or transformed — sanitization would cause login mismatches

### Error Handling
- API routes use `apiError.*` helpers — generic messages only, no stack traces in responses
- Full stack traces logged server-side via `logError()` → CloudWatch
- Frontend error boundaries (`src/app/error.tsx`, `src/app/(dashboard)/error.tsx`) use `error.digest` only
- Password reset tokens: `used_at` set on consumption (replay protection); expiry enforced server-side

---

## 10. Known Gotchas

| Issue | Rule |
|---|---|
| Amplify blocks `AWS_*` env vars at SSR runtime | All AWS SDK clients (S3, Bedrock, SES, EventBridge, Lambda) must use `APP_AWS_ACCESS_KEY_ID` / `APP_AWS_SECRET_ACCESS_KEY` explicitly. IAM user: `fieldsightai-app`, policy: `fieldsightai-app-policy`. |
| AWS SDK module-level init | Never instantiate SDK clients at module level — always inside the handler/function. Amplify injects env vars at request time, not module load time. |
| RDS timezone | Use `AT TIME ZONE 'UTC'` — camera timestamps are stored as-is (NZ local time), no offset needed. `'Australia/Sydney'` not available on RDS. |
| Transcribe job name on retry | Use `{session_id}-r{retry_count}` to avoid job name conflicts |
| Silent audio / no speaker labels | `speaker_labels` can be `null` — handle explicitly in `process_transcript.py` |
| Bedrock JSON response | Strip ` ```json ``` ` fences before parsing — use `parseBedrockJson()` in `src/lib/reports.ts` |
| RealPTT session token | Inject `;jsessionid=XXX` before `?` in URL — not as a query param |
| RealPTT HMAC-SHA1 | `key=SHA1(password)`, `message=random` |
| RealPTT date params | Both `start_time` AND `end_time` required as `"YYYY-MM-DD"` in NZ local time (UTC+12) — missing either or sending datetime format causes API error 1 |
| SSM SecureString | Lambda env var resolution doesn't support SecureString — use plain String |
| Invite vs reset token TTL | Same `password_reset_tokens` table — no type column. Invites: 24h, resets: 15 min. Resend invite invalidates all existing unused tokens for that user. |
| S3 CORS | `fsai-media` bucket requires CORS rule allowing `https://www.fieldsightai.com` for browser direct-upload (presigned PUT). If thumbnails give 403, check CORS first. |
| DB username | Connection string user is `fieldsightai` (not `fsai_admin`). DB: `fieldsightai`. Host: `fieldsightai-db.c3wk8isg47sh.ap-southeast-2.rds.amazonaws.com`. |
| super_admin accounts | Only accounts with `role = 'super_admin'` in the DB have CMS/admin access. `josh.wild@southbase.co.nz` and `benny.huang@preformance.co.nz` are super_admins. |
| Corrupt session cookie | If a user gets a redirect loop, clearing cookies fixes it. `auth()` now auto-deletes invalid/corrupt cookies server-side to prevent loops. |
| Site map embed | Uses **OpenStreetMap** embed (`openstreetmap.org/export/embed.html`) — Google Maps `?output=embed` was dropped as it requires an API key. Coordinates build a bbox + marker URL; address falls back to OSM query param. |
| Report PDF download | "PDF" button opens a new window with formatted HTML then calls `window.print()` — browser saves as PDF. No server-side PDF generation. |
| Report .docx download | Generates a Word-compatible HTML blob (MIME `application/msword`) downloaded as `.doc`. Opens in Word and LibreOffice. No npm dependency — pure browser Blob. |
| Insights cache invalidation | `project_insights` rows are upserted by `project_id` (UNIQUE). Cache age checked client-side via `refreshed_at`. Org insights API reads cached rows only — it never calls Bedrock itself; project insights must be generated per-project first. |
| Shared tasks migration | Migration 019 dropped `user_id` from `project_tasks` and added `created_by`. Old tasks had `user_id` backfilled into `created_by` before the column drop. Index changed to `(project_id, date)`. |
| Bedrock task hallucination | Tasks are seeded once per project+date and cached in DB forever. Bedrock was hallucinating tasks on thin transcripts (4 videos → invented trade-specific items). Fixed: prompt now allows clear inference from stated content but blocks invented topics/trades. If no actionable content, returns `{ "tasks": [] }`. To clear stale hallucinated tasks: `DELETE FROM project_tasks;` |
| Bedrock task prompt grounding | Tasks: allow implied tasks ("that wall needs checking before pour" → task) but not invented topics. Report: added "Do not invent details, names, or activities not mentioned in the transcripts." Both prompts in `src/app/api/projects/[id]/tasks/route.ts` and `src/lib/reports.ts`. |
| Project status toggle | super_admin can archive/restore projects via Settings page. Status card in `projects/[id]/settings/page.tsx` — server action `setStatus` PATCHes `projects.status`. API `PATCH /api/projects/[id]` already restricted status changes to super_admin. |
| Dashboard deduplication | `/dashboard` redirects non-super_admins to `/projects` (same content). Sidebar now shows Dashboard only to super_admin; all others land on Projects as home. Logo link routes to `/projects` for non-super_admins. |

---

## 11. Outstanding Work

### 🚨 Urgent

| Area | Item |
|---|---|
| **Monitoring** | Configure CloudWatch alarms + SNS `fieldsightai-alerts` topic in `lambda/template.yaml` — Lambda error rate, DLQ depth, Amplify 5xx rate; SNS → email notification. No alerting exists today. |
| **Rollback runbook** | Write `RUNBOOK.md` documenting: git revert + push for Amplify rollback, `sam deploy` previous version for Lambda rollback, and DB down-migration command (`node migrations/run-migrations.mjs` with down files). |

### Backlog

| Area | Item |
|---|---|
| Email | Set up `contact@fieldsightai.com` inbox (IT) → update `CONTACT_EMAIL` env var |
| Email | Add MAIL FROM MX + DKIM records for `mail.fieldsightai.com` at Discount Domains |
| Lambda CI/CD | Add GitHub OIDC secret `AWS_DEPLOY_ROLE_ARN` for automated SAM deploys on push |
| Sessions | Bulk-assign unassigned sessions → project + user in one action |
| Marketing | Dedicated /demo page or Calendly embed for booking live walkthroughs |
| Insights | Org insights requires each project to be visited individually first to prime the cache — consider a background job or server-side pre-warming on the org insights page |
| Insights | Keyword grouping in org aggregate is title-keyword-match based (simple NLP) — could improve with embeddings or Bedrock semantic similarity in future |
| Insights (scalability) | **Current approach is a full re-analysis on every refresh** — Bedrock reads all transcript text for the project in one shot (capped at last 20 days, 8000 chars/day), overwrites `project_insights`, 24h TTL. New recordings won't appear until cache expires or user manually refreshes. This is acceptable at current data volumes but **will not scale to multi-year projects** — a 2–3 year site could have 700+ recording days, far exceeding the 20-day sample window and making the snapshot increasingly unrepresentative. **Future work:** migrate to an incremental/delta model — store daily insight records, merge into rolling aggregates, and trigger re-analysis only on new days rather than full history re-reads. |
| Tasks | `members` GET response shape changed (`data[]` not `members[]`) — `ProjectSidePanel` handles both keys defensively; confirm all callers are consistent |
