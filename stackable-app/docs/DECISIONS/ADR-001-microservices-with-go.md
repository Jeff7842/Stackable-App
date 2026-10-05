# ADR-001: Microservices, with Go for about half of the backend

- Date: 2026-10-04
- Status: accepted (owner decision)

## Context

The SDD describes two runtimes sharing one database.
The owner chose microservices, with Go on about half of the backend.
The SDD DFD level 1 already splits the system into nine processes.
Each process owns one store.
They hand off only through the outbox (D8) and documents (D9).
They never call each other directly.

## Decision

Build a pnpm monorepo of services. Each service has:
- Its own Postgres schema and DB role (one Postgres, one schema per service).
- Its own Dockerfile, `/health` and `/ready`.

Rules between services:
- Commands go over HTTP with a short-lived signed service token.
- Facts go as events through each service's outbox, relayed by QStash.
- OpenAPI files in `packages/contracts/openapi/` are the single source of truth. Events use JSON Schema in the same package.
- No service reads another service's tables.

Language split:

| Language | Services | Reason |
|---|---|---|
| Go | `payments`, `communication`, `attendance`, `documents` | Hot, money-critical or concurrent. The SDD already wanted Go here. |
| TypeScript | `identity`, `academics`, `ai`, later `scheduling` and `library`, and the `apps/web` gateway | Close to the web app, forms, Prisma and vendor SDKs. |

Full build: 4 Go runtimes and 5 TypeScript runtimes.

## Why the SDD supports it

DFD level 1 gives the service boundaries already.
`communication` is the only sender of messages.
`documents` is the only renderer.
`payments` is the only owner of the ledger.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Modular monolith | Owner chose microservices. It would have been cheaper (see cost below). |
| All TypeScript | Owner wants Go on about half the backend. The SDD already placed the hot paths in Go. |
| All Go | Web-adjacent services (forms, Prisma, vendor SDKs) are closer to the Next.js app in TypeScript. |

## Consequences

**Cost, stated honestly:**
- About 25-35% more plumbing than a monolith: contracts, service auth, tracing, per-service deploys.
- Cross-service foreign keys disappear. Links become plain ids plus events.
- Cross-module SDD ER arrows (for example `fee_links` to `invoice_lines`) are replaced by ids plus events. See [CONNECTIONS.md](../CONNECTIONS.md).

**Easier:**
- Each service deploys and fails on its own.
- A vendor outage shows as "degraded", not "down".

**Cut line:**
If the schedule slips, ship the MVP services as separate packages in one local process and deploy them separately in Phase B.
Go services need their template first.
If a Go service is not ready by D7, the demo shows it as "Under construction" and it lands by D14.

## Related

- Warning H20 in [WARNINGS.md](../WARNINGS.md).
- [ADR-002](ADR-002-keep-web-app-in-place.md): where the web app lives.
