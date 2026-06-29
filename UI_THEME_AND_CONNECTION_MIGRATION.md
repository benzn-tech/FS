# UI Theme + Site Connection — Migration Pack

Two things packaged for porting to another repo:
1. **The color/UI theme** — every token, where it lives, and how to reuse it.
2. **How the public website (marketing) connects to the logged-in app (dashboard).**

> Source: `benzn-tech/FS` (FieldSightAI), Next.js 16 App Router + Tailwind v4.

---

## Part 1 — Color Theme

### 1.1 The palette (single source of truth)

| Token | Hex | Used for |
|-------|-----|----------|
| **brand** (brand-500) | `#FFD966` | Primary buttons, logo accent ("Sight"), highlights |
| brandHover (brand-600) | `#FFC107` | Primary button hover |
| brand-700 | `#FF8F00` | Outline-button text |
| brand-50 → brand-400 | `#FFFDE7 #FFF9C4 #FFF59D #FFF176 #FFEE58` | Tints (light fills, badges) |
| background | `#FFFFFF` | Page background |
| backgroundAlt | `#F9FAFB` | Dashboard canvas, auth pages, hover fills |
| textPrimary | `#111827` | Headings, body text |
| textSecondary | `#6B7280` | Muted text, nav labels, footnotes |
| border | `#E5E7EB` | All borders / dividers |
| danger | `#EF4444` | Destructive actions, errors |
| sidebar | `#111827` | Dashboard sidebar background (same as textPrimary) |

**Typography:** Inter (`next/font/google`, exposed as `--font-sans`).
**Radii:** button `0.5rem`, card `1rem`.

This is a **warm-yellow brand on a neutral gray-900/gray-500 base** — light theme only (no dark mode defined).

### 1.2 Where the theme is defined (3 places — important)

The theme currently lives in **three** spots, which you must keep in sync when migrating:

1. **`src/app/globals.css`** — the real runtime source. Tailwind v4 `@theme inline { ... }` block declares CSS custom properties (`--color-brand-500`, `--color-background`, etc.). This is what actually generates Tailwind utility classes and what the browser uses.
2. **`src/config/theme.ts`** — a TypeScript mirror (`export const theme = {...}`) for referencing colors in JS/TS logic. **Not auto-synced** with the CSS — it's a hand-maintained copy.
3. **Hardcoded hex literals in components** — most components use arbitrary Tailwind values like `bg-[#FFD966]`, `text-[#6B7280]`, `border-[#E5E7EB]` directly instead of the semantic tokens (see `Button.tsx`, `MarketingNav.tsx`, layouts).

> ⚠️ **Migration trap:** because the palette is duplicated across CSS tokens, the TS object, **and** inline hex literals, changing the brand color is not a one-line edit today. To rebrand you currently must: edit `globals.css`, edit `theme.ts`, then find-and-replace every `#FFD966`/`#FFC107`/etc. literal across components.

### 1.3 How to port it cleanly

**Minimum (drop-in, same structure):**
- Copy the `@theme inline { ... }` block from `globals.css` and the `:root`/`body` rules.
- Copy `src/config/theme.ts`.
- Ensure Inter is wired in the root layout via `next/font/google` with `variable: '--font-sans'`.
- Dependencies: `tailwindcss@4`, `@tailwindcss/postcss`, `clsx`, `tailwind-merge` (the `cn()` helper), `lucide-react` (icons), `framer-motion` (button tap/nav animations).

**Recommended (fix the duplication while migrating):**
- Make `globals.css` the *only* source. Replace inline `bg-[#FFD966]` literals with token classes (`bg-brand`, `text-text-secondary`, `border-border`) so a rebrand = editing one file.
- Either delete `theme.ts` or generate it from the CSS tokens so it can't drift.

### 1.4 Component → token cheat sheet (for re-skinning)

- **Primary button** = `bg-[#FFD966] text-gray-900 hover:bg-[#FFC107]`
- **Outline button** = `border-2 border-[#FFD966] text-[#FF8F00] hover:bg-[#FFD966]`
- **Danger button** = `bg-[#EF4444] text-white`
- **Sidebar** = `#111827` bg
- **Dashboard canvas / auth pages** = `#F9FAFB` bg
- **Logo treatment** = `Field` + `<span className="text-[#FFD966]">Sight</span>` + `AI` (brand color only on the middle word)

---

## Part 2 — Marketing ↔ Dashboard Connection

### 2.1 Route-group architecture (one Next.js app, four zones)

Everything is **one Next.js app**, split by App Router **route groups** (folders in
parens don't affect the URL — they only swap the layout):

```
src/app/
  layout.tsx            ← root: <html>, Inter font, globals.css  (wraps ALL zones)
  (marketing)/          → public website   — / about pricing contact privacy terms
      layout.tsx        ← MarketingNav (top) + Footer, no auth
  (auth)/               → login/register   — /login /register /forgot-password /reset-password
      layout.tsx        ← centered card on #F9FAFB, no auth
  (dashboard)/          → logged-in app    — /dashboard /projects /sessions /devices /settings ...
      layout.tsx        ← Sidebar + DashboardHeader, AUTH-GATED
  (admin)/              → admin area       — /admin
      layout.tsx        ← auth-gated (elevated role)
  api/                  → backend routes   — /api/auth/login, /api/sessions, ...
```

Same brand, same fonts everywhere (inherited from the root layout). The public
site and the app are **not separate deployments** — they're route groups in the
same Amplify-hosted build.

### 2.2 The connection path (public → authenticated)

```
Marketing site (/)                       ← (marketing) layout, public
   │  MarketingNav has two CTAs:
   │   • "Log In"      → /login          ← (auth) layout
   │   • "Get Started" → /register
   ▼
/login  (LoginForm, client component)
   │  POST /api/auth/login  { email, password }
   │     → signInWithCredentials():  DB lookup + bcrypt.compare
   │     → createSession():  signs a JWT (jose, HS256, APP_SECRET)
   │     → sets httpOnly cookie  `fsai_session`  (7-day expiry)
   ▼  on success, client does router.push(callbackUrl ?? '/dashboard')
/dashboard  ← (dashboard) layout
   │  Server-side: await auth() reads the cookie, verifies JWT,
   │  re-checks the user still exists in DB.
   │   • no/invalid session → redirect('/login')
   │   • valid → render Sidebar + Header + page
```

### 2.3 Auth mechanism (what actually gates the app)

- **Stateless JWT-in-cookie**, hand-rolled with `jose` (no NextAuth despite the
  dep being present). Defined in `src/lib/auth.ts`.
- Cookie: `fsai_session`, `httpOnly`, `sameSite: 'lax'`, `secure` in prod, 7-day.
- Signing secret: `APP_SECRET` env var (falls back to `dev-secret-change-me`).
- **No `middleware.ts`.** Gating is done **per-layout**: each protected route
  group's `layout.tsx` calls `await auth()` server-side and `redirect('/login')`
  if absent. The `(marketing)` and `(auth)` groups simply don't call it.
- `auth()` also **re-validates against the DB** on every request (catches
  deleted/recreated users) and self-heals by deleting corrupt cookies.
- **Redirect rules:**
  - Logged-in user hitting `/login` → bounced to `/dashboard` (login page checks `auth()`).
  - Logged-out user hitting `/dashboard` → bounced to `/login` (layout checks `auth()`).
  - `?callbackUrl=` is honored so deep links return the user to where they were.

> Note: `(dashboard)/layout.tsx` has a `DEV_BYPASS = NODE_ENV === 'development'`
> that **skips auth entirely in dev** and fakes a `super_admin` user. Make sure
> this never evaluates true in the migrated prod environment.

### 2.4 The shared seams between the two halves

What ties the public site and the app together (these are your migration touch-points):

| Seam | File | Role |
|------|------|------|
| Brand identity (name, tagline, nav, footer links) | `src/config/site.ts` | Shared by marketing AND auth pages |
| Visual theme | `globals.css` + root `layout.tsx` | Inherited by all four zones |
| Login entry | `MarketingNav` → `/login` / `/register` | The only public→app doorway |
| Session creation | `/api/auth/login` → `lib/auth.ts` | Issues the `fsai_session` cookie |
| Session gate | each protected `layout.tsx` → `auth()` | Enforces login |
| Post-login landing | `LoginForm` → `/dashboard` | Default destination |

### 2.5 To migrate the connection model

1. Keep the **route-group split** (`(marketing)`/`(auth)`/`(dashboard)`/`(admin)`) — it's what lets one app, one domain, one build serve both the public site and the gated app.
2. Port `src/lib/auth.ts` (JWT/cookie helpers) + `/api/auth/*` routes. Set a real `APP_SECRET`.
3. Port `src/config/site.ts` and rebrand strings/links there (single file).
4. Gate protected layouts with `await auth()` + `redirect('/login')`; leave marketing/auth layouts ungated.
5. Decide on the dev bypass — keep it only if you understand it's dev-only.
6. If you prefer edge-level gating over per-layout checks, you can add a
   `middleware.ts` matching `/dashboard`, `/projects`, etc. — but the current
   per-layout approach works without it and also does the DB re-check.

---

## Migration checklist

**Theme**
- [ ] Copy `@theme` block + `:root`/`body` from `globals.css`
- [ ] Copy `src/config/theme.ts` (or regenerate from CSS to avoid drift)
- [ ] Wire Inter via `next/font/google` (`--font-sans`) in root layout
- [ ] Install: tailwindcss@4, @tailwindcss/postcss, clsx, tailwind-merge, lucide-react, framer-motion
- [ ] (Recommended) replace inline `#FFD966`-style literals with token classes

**Connection**
- [ ] Recreate the four route groups with their layouts
- [ ] Port `lib/auth.ts` + `/api/auth/*`; set `APP_SECRET`
- [ ] Port `config/site.ts` (rebrand here)
- [ ] Auth-gate dashboard/admin layouts; leave marketing/auth open
- [ ] Verify the dev bypass can't trigger in prod
- [ ] Test: `/` → Log In → `/login` → cookie set → `/dashboard`; logged-out `/dashboard` → `/login`
