# Deletions

What was removed, why, and what replaced it.

## 2026-10-04 (D1)

### `next-auth` dependency

**What:** removed `next-auth` `5.0.0-beta.30` from `stackable-app/package.json`.
**Why:** no imports found in `stackable-app` (`*.ts` and `*.tsx`, excluding `node_modules` and `.next`). Better Auth is the chosen identity path (H1).
**Replaced by:** nothing. `better-auth` stays.
**Risk:** `NEXTAUTH_SECRET` is no longer read anywhere in `lib/school-security.ts`. Other readers were not searched.

### Secret fallbacks in `getSchoolSecret`

**What:** removed three fallbacks in `stackable-app/lib/school-security.ts`:
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- the string `"stackable-school-security-secret"`

**Why:** a hardcoded secret is public to anyone with the repo. The other two are unrelated keys reused as a silent default (H9).
**Replaced by:** a thrown error when `SCHOOL_SECURITY_CODES_SECRET` is unset.
**Risk:** codes derived under an old fallback no longer match. See H21 in [WARNINGS.md](WARNINGS.md).

### Nested pnpm workspace and lockfile

**What:** removed `stackable-app/pnpm-workspace.yaml` and `stackable-app/pnpm-lock.yaml`.
**Why:** pnpm needs one workspace root, now the repo root ([CHANGELOG](CHANGELOG.md) item 5).
**Replaced by:** `pnpm-workspace.yaml`, `package.json` and `pnpm-lock.yaml` at the repo root.
**Risk:** versions were re-resolved. Lockfile history is in git.

### Placeholder `test` script

**What:** removed `"test": "echo \"Error: no test specified\" && exit 1"` from `stackable-app/package.json`.
**Why:** Vitest now runs from the root (`pnpm test`).

## 2026-10-05 (D2)

### Old placeholder markup in 40 stub pages

**What:** replaced the markup in 40 stub pages under `app/` (for example `app/dashboard/exams/page.tsx` and `app/(parent)/family/fees/page.tsx`).
**Why:** hard-coded colours and emoji, which did not match the design system.
**Replaced by:** the `ComingSoon` component.
**Risk:** none known. Pages show no real data.
