# Warnings

Known hiccups.
H1-H20 come from the approved plan's first-pass audit.
H21-H22 were found while writing D1 docs.
"Status" is the state on 2026-10-04.

| # | Finding | Planned action | Status |
|---|---|---|---|
| H1 | Two identity stores: `users` and `ba_user`. `ba_*` tables are in no migration. Legacy auth is the default. | Finish Better Auth, migrate `ba_*`, one identity path, remove `next-auth`. | `next-auth` removed. Rest open. |
| H2 | SDD has `Membership`. Repo has one `users` row per school. | Defer. See [ADR-003](DECISIONS/ADR-003-defer-membership.md). | decided |
| H3 | Roles drift. SDD has 9, repo has 8 (`manager`, `pupil`, `staff` not in SDD). No finance, secretary, driver, dept-head. | Map and extend roles. DB CHECK or enum. Staff portal. | open |
| H4 | SDD says 46 models. `stage` and `origin/main` have 41. Local `main` is stale at 30. | Treat SDD ER as approximate. Pull `main`. List the 5 missing tables. | open |
| H5 | `schools` has no `@id`. Some tables key on `school_name`, some on id. | Fix before RLS. RLS needs one tenant id. | open |
| H6 | `phone` is BigInt (loses leading zero). `schools.status` default is `'pending::text'`. Names default to "NULL". | One data-fix migration with a padded-backfill check. | open |
| H7 | No enums. Statuses are free strings. | CHECK constraints or Prisma enums for new modules. | open |
| H8 | Ledger design drifts across figures (`studentId`, `fundraiserId`, `fundAccountId`). | One append-only account-based ledger with nullable references. | open |
| H9 | Rate limit failed open. Hardcoded secret fallback. `env.ts` demanded unused vars. | Fail closed, throw on missing secret, fix env. | done 2026-10-04. See [CHANGELOG](CHANGELOG.md). |
| H10 | Storage is still Supabase. | Move `lib/storage.ts` to R2. | open |
| H11 | No tests, no CI. `*.check.ts` never ran. | Vitest, Playwright, GitHub Actions. | Vitest and `pnpm check` done. CI and Playwright open. |
| H12 | Prompts say "leave salaries alone". Phase 1 designs payroll. Go engine timing differs between prompts and SDD. | Payroll, wallet and others are "Under construction". Engine logic stays Go-ready. | decided in plan |
| H13 | 12 h event auto-refund contradicts "no payout without authorization". Super Admin "pay salary" crosses tenancy. Browser camera proctoring is not achievable. | Not in MVP. Owner decision needed. | see [OPEN-QUESTIONS](OPEN-QUESTIONS.md) |
| H14 | Route typos: `calender`, `quizes`, `cognitive-abilities-test`. | Rename to `calendar`, `quizzes`, `continuous-assessment`, with redirects. | open |
| H15 | SDD palette `#3ECF1E` differs from the repo palette. | Owner chose the repo palette. | decided |
| H16 | RLS with Prisma and Neon pooling. | `SET LOCAL app.school_id` in one interactive transaction (`withSchool()`). Migrations run as owner. | open |
| H17 | Exams are modelled twice (`assessments.type` and a separate Exams module). | `assessments` stays CAT, quiz, RAT. Exams get own tables. ADR before the exams phase. | open |
| H18 | SDD ER draws few foreign keys. `attendance` uses polymorphic `user_type`/`user_id`. | Explicit FKs everywhere. Attendance: two nullable FKs plus CHECK. | open |
| H19 | `.github/` sits at the repo root. | CI at root with `working-directory: stackable-app`. | open |
| H20 | Microservices change "two runtimes, one database" to several runtimes with a schema each. Cross-module ER arrows cross service boundaries. | [ADR-001](DECISIONS/ADR-001-microservices-with-go.md). Ids plus events. [CONNECTIONS.md](CONNECTIONS.md). | decided |

## H21: security codes cannot be regenerated

`generateSchoolSecurityCode` in `stackable-app/lib/school-security.ts` derives a code as an HMAC of `school-security:<schoolId>:<label>` with the secret.
The same school and label always give the same code.
So "regenerate and invalidate the previous code" cannot work.
It needs a version counter (or a stored random salt) in the derivation.

Related:
- `buildSchoolSecurityCodeRows` stores only `hashSchoolSecurityCode(code)` (SHA-256) in `code_hash`.
- Changing `SCHOOL_SECURITY_CODES_SECRET` changes every derived code.
- Codes issued under the old fallback secrets (see [DELETIONS.md](DELETIONS.md)) will not match.

Action: add a version counter before building the regenerate feature.
Needs an owner decision on the data model. See OPEN-QUESTIONS.md.

## H22: `schools` has no `@id`, and the model count differs

`schools` has no `@id` (same finding as H5).
The SDD says 46 models.
Stage has 41 (counted in the plan's first pass; not re-counted here).
Status: open. Plan task: list the 5 missing tables on D1.

## H23: the `live` nav flag is a status dot

The `live` flag on nav items in `lib/nav.ts` shows a pulsing green dot.
It does not mean "page is built".
Do not use it to hide unbuilt pages.
Use the `soon` flag and the `SOON_HREFS` set instead. They show a "Soon" tag.
This corrects the plan, which said to reuse `live`.

## H24: `dept-head` belongs to the teacher portal

The plan put `dept-head` in the staff portal.
SDD page map P4-18 puts it in `/teach`.
`lib/validation/shared.ts` now maps `dept-head` to the teacher portal.
Only `finance`, `secretary` and `driver` use `/staff`.
Status: plan corrected.

## H25: icon libraries load from CDNs with `@latest`

`app/layout.tsx` loads Tabler Icons CSS from `cdn.jsdelivr.net` and lucide from `unpkg.com`.
Both use `@latest`.
A new upstream release changes the site with no review. A compromised release runs on every page.
The scripts also add network requests to every page load.
Action: install the packages locally and pin versions.
Status: open. Not changed yet.
