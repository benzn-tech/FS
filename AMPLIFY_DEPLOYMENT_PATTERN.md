# Amplify Deployment Pattern (Portable Runbook)

A reusable recipe for hosting a **full-stack Next.js app** (pages + API routes +
Server Components) on **AWS Amplify Hosting**, while the heavy backend
(async Lambdas, infra, DB) lives in separate stacks. Copy this into any repo to
get the same deploy model.

> Reference implementation: `benzn-tech/FS` (FieldSightAI). This document
> generalises that setup so other repos can adopt it without re-deriving it.

---

## 1. What this pattern gives you

| Layer | Hosted by | Deploy trigger |
|-------|-----------|----------------|
| Next.js UI + API routes + SSR | **Amplify Hosting** | `git push` to a connected branch |
| Async workers (Lambda) | SAM (`lambda/`) | GitHub Actions on `lambda/**` |
| Infrastructure (S3 / EventBridge / IAM / SSM) | CDK (`infra/`) | manual `cdk deploy` (optional CI) |
| Database schema | SQL migrations | migration runner script |

**Amplify owns only the app tier** (the Next.js process). It talks to the rest
of AWS at request time using an IAM identity + a small set of env vars. That
"talks to AWS" contract is the portable part — it's three files plus a
credential convention.

**Use this pattern when:** the app is Next.js with SSR / Server Actions / API
routes, the rest of your AWS resources already exist in the same account, and
you want branch-based dev/prod environments with zero server management.

---

## 2. The connection method (the 3 pieces + 1 convention)

### Piece 1 — `amplify.yml` (build spec, repo root)

Amplify reads this on every build. It does two jobs: **inject env vars into the
build** and **build Next.js**.

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        # Pull Amplify console env vars into the build output.
        # NOTE: Amplify blocks setting reserved AWS_* names in the console,
        # so we store them as APP_AWS_* and re-map them here.
        - echo "DATABASE_URL=$DATABASE_URL" >> .env.production
        - echo "APP_SECRET=$APP_SECRET" >> .env.production
        - echo "APP_URL=$APP_URL" >> .env.production
        - echo "AWS_REGION=ap-southeast-2" >> .env.production
        - echo "S3_VIDEOS_BUCKET=$S3_VIDEOS_BUCKET" >> .env.production
        - echo "S3_TRANSCRIPTS_BUCKET=$S3_TRANSCRIPTS_BUCKET" >> .env.production
        - echo "S3_MEDIA_BUCKET=$S3_MEDIA_BUCKET" >> .env.production
        - echo "AWS_ACCESS_KEY_ID=$APP_AWS_ACCESS_KEY_ID" >> .env.production
        - echo "AWS_SECRET_ACCESS_KEY=$APP_AWS_SECRET_ACCESS_KEY" >> .env.production
        - echo "APP_AWS_ACCESS_KEY_ID=$APP_AWS_ACCESS_KEY_ID" >> .env.production
        - echo "APP_AWS_SECRET_ACCESS_KEY=$APP_AWS_SECRET_ACCESS_KEY" >> .env.production
        - echo "EVENTBRIDGE_BUS_NAME=$EVENTBRIDGE_BUS_NAME" >> .env.production
        # ...any other app/service env vars...
        - npm ci --cache .npm --prefer-offline
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - .npm/**/*
```

**Why the `echo >> .env.production` dance?** Amplify console env vars are not
automatically present in the Next.js runtime for SSR. Writing them into
`.env.production` at build time bakes them into the build so `process.env.X`
works in API routes and Server Components.

**Why `APP_AWS_*` AND `AWS_*`?** Amplify **reserves** the `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` names and won't let you set them in the console. So you
set `APP_AWS_ACCESS_KEY_ID` in the console, then re-map to the SDK's standard
`AWS_ACCESS_KEY_ID` here. (Preferred long-term: drop the keys entirely and use
the SSR role — see §5.)

### Piece 2 — `amplify-policy.json` (IAM policy for the SSR role, repo root)

This is the **least-privilege policy** attached to the role the Next.js runtime
uses. It is the entire surface the app is allowed to touch in AWS. Template:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::<videos-bucket>/*",
        "arn:aws:s3:::<transcripts-bucket>/*",
        "arn:aws:s3:::<media-bucket>/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::<videos-bucket>",
        "arn:aws:s3:::<transcripts-bucket>",
        "arn:aws:s3:::<media-bucket>"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["events:PutEvents"],
      "Resource": "arn:aws:events:<region>:<account-id>:event-bus/<bus-name>"
    },
    {
      "Effect": "Allow",
      "Action": ["lambda:InvokeFunction"],
      "Resource": [
        "arn:aws:lambda:<region>:<account-id>:function:<export-fn-1>",
        "arn:aws:lambda:<region>:<account-id>:function:<export-fn-2>"
      ]
    }
  ]
}
```

Adjust the four statements to whatever your API routes call: S3 (presigned
URLs / object I/O), EventBridge (kick off async pipeline), and direct Lambda
invoke (synchronous actions). Add SES, DynamoDB, etc. as needed.

### Piece 3 — Runtime AWS client convention (in app code)

Every AWS client is constructed so it works **both** with static keys (current)
**and** with the SSR role (target), with no code change:

```ts
// src/lib/s3.ts (and eventbridge.ts, ses.ts, ... — same shape everywhere)
function makeClient() {
  return new SomeAWSClient({
    region: process.env.AWS_REGION ?? '<region>',
    credentials: process.env.APP_AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
        }
      : undefined,   // ← undefined = fall back to the IAM role (default chain)
  })
}
```

Rules that make this robust:
- **Construct the client per request** (or read creds at call time), not at
  module load — Amplify SSR refreshes role credentials in `process.env`, and a
  module-level singleton can cache stale/empty creds.
- **`undefined` credentials is the goal**, not a bug — it tells the SDK to use
  the default provider chain, which resolves to the Amplify SSR role.

### Convention — the env var contract (`.env.example`, repo root)

This is the checklist a new repo fills in. Keep it committed so the contract is
discoverable:

```bash
# App
APP_SECRET=<random-secret>
APP_URL=https://<your-domain>

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# AWS
AWS_REGION=<region>
APP_AWS_ACCESS_KEY_ID=         # leave blank to use the SSR role (preferred)
APP_AWS_SECRET_ACCESS_KEY=
S3_VIDEOS_BUCKET=<videos-bucket>
S3_TRANSCRIPTS_BUCKET=<transcripts-bucket>
S3_MEDIA_BUCKET=<media-bucket>
EVENTBRIDGE_BUS_NAME=<bus-name>

# Integrations (optional)
CONTACT_EMAIL=contact@example.com
ACONEX_BASE_URL=https://api.aconex.com
```

---

## 3. Migrating the pattern to a new repo

1. **Copy 3 files to the new repo root**: `amplify.yml`, `amplify-policy.json`,
   `.env.example`. Edit bucket / bus / function / region / account placeholders.
2. **Adopt the client convention** (§2 Piece 3) for every `@aws-sdk/client-*`
   you use. Read creds at call time; allow `undefined` → role fallback.
3. **Create the SSR role** in the target account and attach
   `amplify-policy.json` (see §5 — prefer this over static keys).
4. **In Amplify console**: *New app → Host web app → connect the GitHub repo →
   pick the branch.* Amplify auto-detects Next.js and uses `amplify.yml`.
5. **Set env vars in the Amplify console** for that branch (everything in
   `.env.example`). Remember: store AWS keys under `APP_AWS_*`, never the
   reserved `AWS_*` names.
6. **Attach the role** to the app's compute settings (App settings → IAM roles
   → SSR/compute role).
7. **Push** → Amplify builds and deploys. Verify an API route that touches S3 /
   EventBridge actually works (presigned URL, publish event).

That's the whole app tier. The backend (Lambda/CDK/DB) is deployed by its own
pipelines and is **not** part of this Amplify setup.

---

## 4. dev / prod via branches (what makes this multi-environment)

Amplify Hosting maps **one branch → one environment** natively:

- Connect `main` → prod env, `dev` → dev env (each gets its own URL + its own
  env var set + its own role).
- Feature branches / PRs can auto-create preview environments.
- Pair with a CI workflow that type-checks both branches before they deploy:

```yaml
# .github/workflows/ci.yml
on:
  pull_request: { branches: [main, dev] }
  push:         { branches: [main, dev] }
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run build
        env:                       # dummy values so build doesn't fail
          APP_SECRET: ci-placeholder-secret
          APP_URL: http://localhost:3000
          DATABASE_URL: ""
          AWS_REGION: <region>
```

**To keep environments truly isolated**, give dev its own buckets / bus /
function names (suffix `-dev`) and its own `amplify-policy.json` scoped to those
ARNs. Point the dev branch's env vars at the dev resources.

---

## 5. Recommended hardening (do this on migration)

- **Drop static AWS keys; use the SSR role.** Leave `APP_AWS_ACCESS_KEY_ID`
  blank in the console and delete the four `AWS_*`/`APP_AWS_*` key lines from
  `amplify.yml`. The client convention already falls back to the role. This
  removes long-lived credentials from build logs and `.env.production`.
- **One role per environment**, each with a policy scoped to that env's ARNs.
- **Keep the policy minimal** — only the services your API routes actually call.
- **Never commit real secrets.** `.env.example` holds placeholders; real values
  live only in the Amplify console (and GitHub Actions secrets for the backend).

---

## 6. Migration checklist

- [ ] `amplify.yml` copied; placeholders + env list updated
- [ ] `amplify-policy.json` copied; ARNs (buckets/bus/functions/region/account) updated
- [ ] `.env.example` copied; contract reflects this repo's services
- [ ] All `@aws-sdk/client-*` constructed per-request with role fallback
- [ ] SSR role created in target account, policy attached
- [ ] Amplify app created, GitHub branch(es) connected
- [ ] Console env vars set per branch (AWS keys under `APP_AWS_*`, or blank for role)
- [ ] `ci.yml` type-check/build on `main` + `dev`
- [ ] dev resources isolated (suffixed names + scoped policy) if multi-env
- [ ] Verified: an S3 + an EventBridge API route work post-deploy
- [ ] Static keys removed once the role is confirmed working

---

## 7. Scope boundary (what this pattern is NOT)

This covers the **Next.js app tier only**. It does **not** deploy:
- async workers → see `lambda/` + `.github/workflows/deploy-lambdas.yml` (SAM)
- infrastructure → see `infra/` (CDK)
- DB schema → see `migrations/` + runner

Those have their own pipelines. Amplify just needs the resources they create to
already exist, and the policy in §2 to reach them.
