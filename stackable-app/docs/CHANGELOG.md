# Changelog

Newest first. Each entry records what changed, why, alternatives considered, and resources used.
Paths are relative to the repo root.

## 2026-10-05 (D2)

### 9. Roles extended and a staff portal added

**What:**
`lib/validation/shared.ts` adds `dept-head`, `finance`, `secretary` and `driver`.
`finance`, `secretary` and `driver` use the new `/staff` portal (`app/(staff)/`).
`dept-head` uses the teacher portal (`/teach`).
`proxy.ts` now matches `/staff/:path*`.
Nav sections carry an optional `roles` field. `navFor(portal, role)` in `lib/nav.ts` filters by it.
The sidebar, bottom nav, quick search, navbar, user menu and profile modal pass the role from `useMe`.

**Why:**
Plan item H3. The SDD page map P4-18 puts `dept-head` in `/teach`, so the plan text was wrong. See H24 in [WARNINGS.md](WARNINGS.md).

**Alternatives considered:** `dept-head` in the staff portal (the plan). Rejected: it contradicts the SDD page map.

### 10. "Soon" tag for unbuilt pages

**What:**
`lib/nav.ts` has a `soon` flag and a `SOON_HREFS` set.
Items in the set show a "Soon" tag.
Remove an href from `SOON_HREFS` when its page is built.

**Why:** the existing `live` flag is a pulsing status dot, not a built-or-not flag. See H23.

### 11. Stub pages replaced by `ComingSoon`

**What:**
40 stub pages had hard-coded colours and emoji.
They now use the design-system `ComingSoon` component, generated from one table.
Each portal also has a catch-all `[...slug]` page. The staff one is `app/(staff)/staff/[...slug]/page.tsx`.

**Why:** one look for every unbuilt page. See [DELETIONS.md](DELETIONS.md).

### 12. Demo mode

**What:** `/demo` role picker, cookie `stackable_demo`, a `window.fetch` interceptor and `sessionStorage` data.
**Why and alternatives:** [ADR-005](DECISIONS/ADR-005-demo-mode.md).
**Tests:** vitest suites `lib/demo/mode.test.ts` and `lib/demo/router.test.ts`.

### 13. Health, readiness and error pages

**What:**
- `GET /api/health`: liveness (`app/api/health/route.ts`).
- `GET /api/ready`: the database is required, Redis is optional. It returns 503 if the database is down and `degraded` if only Redis is. Each probe times out after 5 s, because Neon cold starts take seconds.
- `app/error.tsx`, `app/not-found.tsx`, and `error.tsx` and `loading.tsx` in each portal group and in `dashboard/`. Portal files use `components/dashboard/PortalError.tsx` and `PortalLoading.tsx`.

**Why:** plan health and error standard. See [CONNECTIONS.md](CONNECTIONS.md).

## 2026-10-04 (D1)

### 1. Rate limits fail closed in production

**What:**
`rateLimitOrSkip` in `stackable-app/lib/api/ratelimit.ts` wraps `enforceRateLimit`.
A Redis outage returns a 503 (`serviceUnavailable`) in production.
Outside production it logs a warning and lets the request through.
A real 429 (`ApiError`) always passes through.

**Used by:**
- `maybeRateLimit` in `stackable-app/lib/api/guard.ts`.
- `authLimit` in `stackable-app/lib/auth/otp.ts`.

**Why:**
Plan item H9: rate limiting failed open without Redis.
Abuse protection must never be silently off in production.

**Alternatives considered:**
- Keep fail-open: rejected, it is the bug H9 describes.
- Fail closed everywhere: not chosen. Local development has no Redis. (Reason inferred from the plan's "fail open nowhere in production"; confirm with the owner.)

**Resources:** `@upstash/ratelimit`, `@upstash/redis` (already installed).

### 2. School security secret has no fallback

**What:**
`getSchoolSecret` in `stackable-app/lib/school-security.ts` now throws if `SCHOOL_SECURITY_CODES_SECRET` is unset.
Removed fallbacks: `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, and the hardcoded string `"stackable-school-security-secret"`.

**Why:**
Plan item H9: a hardcoded secret makes every code derivable by anyone who reads the repo.
Supabase was abandoned, so its key is the wrong source for this secret.

**Alternatives considered:**
- Keep one fallback: rejected, any fallback is a silent weak default.

**Impact:**
Any environment without `SCHOOL_SECURITY_CODES_SECRET` now fails when it signs tokens or generates codes.
Codes already issued under a fallback secret will not match newly derived codes. See H21 in [WARNINGS.md](WARNINGS.md).

### 3. Environment schema rewritten

**What:**
`stackable-app/lib/env.ts` now requires `OTP_HASH_SECRET` and `SCHOOL_SECURITY_CODES_SECRET`.
Upstash Redis and R2 variables are required only in production (`prodOnly`).
`DIRECT_URL`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` stay optional.

**Why:**
Plan item H9: the old file demanded variables the app does not use.

**Open point:**
`otp.ts` still accepts `BETTER_AUTH_SECRET` when `OTP_HASH_SECRET` is unset.
`env.ts` requires both, so the fallback never applies when `getServerEnv()` runs. See OPEN-QUESTIONS.md.

### 4. Every API error carries a request id

**What:**
`toErrorResponse` in `stackable-app/lib/api/errors.ts` adds `requestId` to the JSON body and an `x-request-id` header.
It generates a UUID when the caller passes none.
Added `serviceUnavailable` (HTTP 503, code `UNAVAILABLE`).

**Why:**
Plan error standard: one request id must trace a failure across logs and Sentry.

**Alternatives considered:**
- Change the envelope to `{ code, message, requestId }` as the plan text says: rejected. See [ADR-004](DECISIONS/ADR-004-error-envelope.md).

### 5. Repo is a pnpm workspace at the root

**What:**
- Added `pnpm-workspace.yaml`, `package.json` and `pnpm-lock.yaml` at the repo root.
- Workspace packages: `stackable-app`, `packages/*`, `services/*`.
- Removed `stackable-app/pnpm-workspace.yaml` and `stackable-app/pnpm-lock.yaml`.
- Dependency versions were re-resolved in the new lockfile.
- Pinned `better-auth` to `1.6.18` (was `^1.6.18`).

**Why:**
Plan: pnpm monorepo for the microservice layout ([ADR-001](DECISIONS/ADR-001-microservices-with-go.md)).
The pin exists because `better-auth` 1.7.x changed the TwoFactor types and broke typecheck. (Source: lead's D1 notes.)

**Alternatives considered:**
- Keep the nested workspace and add a second one: rejected, pnpm needs one workspace root.
- Allow `^1.6.18`: rejected until the 1.7 TwoFactor type change is handled.

**Resources:** pnpm workspaces. See [RESOURCES.md](RESOURCES.md).

### 6. `next-auth` removed

**What:**
Removed `next-auth` `5.0.0-beta.30` from `stackable-app/package.json`.

**Why:**
No imports found in `stackable-app` (searched `*.ts` and `*.tsx`, excluding `node_modules` and `.next`).
Plan item H1: one identity path, Better Auth.
See [DELETIONS.md](DELETIONS.md).

### 7. Vitest added

**What:**
Added `vitest.config.ts` at the repo root and `vitest` `^3.2.4` in the root `package.json`.
It runs `stackable-app/**/*.test.ts`, `packages/**/*.test.ts` and `services/**/*.test.ts`.
New tests: `stackable-app/lib/api/ratelimit.test.ts` and `stackable-app/lib/school-security.test.ts`.

**Why:**
Plan item H11: the repo had no tests.

**Alternatives considered:**
- Jest: not evaluated in the plan. Reason for choosing Vitest is unverified. See OPEN-QUESTIONS.md.

### 8. `pnpm check` runs all existing check scripts

**What:**
`stackable-app/scripts/run-checks.mjs` finds every `*.check.ts` file and runs each with `tsx`.
It exits non-zero if any fails.
`SKIP_DB_CHECKS=1` skips files named `*.repo.check*`.
Root `pnpm check` calls it through `pnpm --filter stackable-app check`.
Result today: all 9 files pass. (Source: lead's report.)

**Why:**
Plan item H11: the `*.check.ts` scripts never ran.
