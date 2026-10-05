# Connections

What connects to what.
"Today" rows were checked in the repo on 2026-10-04.
"Planned" rows come from the build plan and do not exist yet.

## Today

| From | To | How | Evidence |
|---|---|---|---|
| Web app (gateway) | Postgres on Neon | Prisma 7 with `@prisma/adapter-pg` and `pg` | `lib/db/prisma.ts`, `prisma/schema.prisma` (provider `postgresql`) |
| Route guards | Session tables | `findLiveSession` (legacy cookie) or Better Auth session, chosen by `AUTH_PROVIDER` | `lib/api/guard.ts` |
| Route guards and OTP | Upstash Redis | `@upstash/ratelimit` sliding window; 503 in production if Redis is down | `lib/api/ratelimit.ts`, `lib/api/redis.ts` |
| Web app | QStash | `enqueueJob(name, payload)`; QStash later calls `POST {APP_BASE_URL}/api/jobs/<name>` | `lib/qeue/jobs.ts`, `lib/qeue/qstash.ts` |
| Web app | Resend | `new Resend(RESEND_API_KEY)` in the school route and the job registry | `app/api/school/route.ts`, `lib/qeue/registry.ts` |
| Web app | Supabase Storage | All file access goes through one module | `lib/storage.ts` |
| Web app | Cloudflare R2 | AWS S3 SDK installed. Wiring unverified. | `package.json` |

Notes:
- All paths above are under `stackable-app/`.
- `lib/storage.ts` still uses `@supabase/supabase-js`. Moving to R2 is warning H10.
- The database is Neon today. A VPS Postgres move is planned and needs no code change if SQL stays portable.

## Planned service map

All rows are **planned**.
Language and ownership come from [ADR-001](DECISIONS/ADR-001-microservices-with-go.md).

| Service | Language | Owns | Status |
|---|---|---|---|
| web gateway (`stackable-app/`) | TypeScript | Sessions, portals, `/demo`; calls services over HTTP | exists (see ADR-002) |
| `identity` | TypeScript | Better Auth, roles, 2FA, impersonation, audit | planned |
| `academics` | TypeScript | Homework, CATs, grading; later exams, curriculum | planned |
| `ai` | TypeScript | Provider adapter, answer gate, leak check | planned |
| `scheduling` | TypeScript | Timetable and leave | planned (Phase C) |
| `library` | TypeScript | Global library | planned (Phase C) |
| `payments` | Go | Fees, ledger, webhooks; later events, wallet, payroll, fundraisers | planned |
| `communication` | Go | Outbox relay, fan-out, deliveries; later threads and escalation | planned |
| `attendance` | Go | Device ingest, events, deviation evaluator | planned |
| `documents` | Go | PDF and Excel renderer, cache, R2 | planned |

Shared packages (all planned): `packages/contracts`, `packages/db`, `packages/observability`, `packages/service-kit`, `packages/go-kit`.

## Planned links between services

| Link | Mechanism |
|---|---|
| Gateway to any service | HTTP command with signed service token (carries `schoolId` and actor) |
| Service to service facts | Event through the sender's outbox, relayed by QStash |
| `fee_links` to `invoice_lines` | Plain id plus event (replaces an SDD cross-module ER arrow) |
| `wallet_transactions` to `impersonation_sessions` | Plain id plus event (same reason) |
| Any service to message sending | Through `communication` only |
| Any service to PDF or Excel | Through `documents` only |
| Any service to ledger | Through `payments` only |

Rules: no shared tables, every handler is idempotent, one request id passes through every hop.

## Added 2026-10-05 (D2)

| From | To | How | Evidence |
|---|---|---|---|
| Browser (demo visitor) | In-memory demo handlers | `window.fetch` interceptor answers `/api/*` from `lib/demo/**`; data in `sessionStorage` | `components/demo/DemoProvider.tsx`, [ADR-005](DECISIONS/ADR-005-demo-mode.md) |
| Page layouts | Demo cookie | `requireRole` returns `null` for a demo cookie with no real session | `lib/api/guard.ts`, `lib/demo/mode.ts` |
| Orchestrator / monitor | Web app | `GET /api/health` (alive), `GET /api/ready` (database required, Redis optional) | `app/api/health/route.ts`, `app/api/ready/route.ts` |
| `/api/ready` | Neon, Upstash Redis | `pingDatabase` and `getRedis().ping()`, 5 s timeout each | `app/api/ready/route.ts` |
| Staff roles | `/staff` portal | `finance`, `secretary`, `driver` route to `app/(staff)/`; `proxy.ts` matches `/staff/:path*` | `lib/validation/shared.ts`, `proxy.ts` |
| Browser | jsdelivr and unpkg CDNs | Tabler Icons and lucide, `@latest` (see H25) | `app/layout.tsx` |
