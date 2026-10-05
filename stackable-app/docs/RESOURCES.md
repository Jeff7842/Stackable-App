# Resources

Libraries and tools, and why each is used.
"Used" means present in the repo on 2026-10-04.
"Planned" means named in the plan and not installed.

## Used

| Resource | Why | Notes |
|---|---|---|
| pnpm workspaces | One lockfile and one install for the web app, packages and services. | Config in root `pnpm-workspace.yaml`. |
| Vitest `^3.2.4` | Unit tests for pure functions such as rate limits and school codes. | Root `vitest.config.ts` aliases `@` to `stackable-app`. Reason over Jest: unverified. |
| tsx `^4.22.4` | Runs TypeScript `*.check.ts` scripts without a build step. | Used by `scripts/run-checks.mjs`. |
| `@upstash/ratelimit`, `@upstash/redis` | Rate limits backed by Redis. | See `lib/api/ratelimit.ts`. |
| `@upstash/qstash` | Background jobs and (planned) outbox relay. | See `lib/qeue/`. |
| Zod `^4.4.3` | Validates environment variables and (planned) every service boundary. | See `lib/env.ts`. |
| `better-auth` `1.6.18` (pinned) | Login and 2FA. | 1.7.x changed TwoFactor types. |
| Prisma 7 with `@prisma/adapter-pg` | Typed database access on Neon. | Go services will not use Prisma. |

## Planned

| Resource | Why |
|---|---|
| Go 1.25 | Runtime for `payments`, `communication`, `attendance`, `documents`. |
| `chi` | Go HTTP router. |
| `pgx` | Go Postgres driver. |
| `sqlc` | Typed Go queries from SQL. |
| `goose` | SQL migrations per Go service, since Prisma does not manage Go schemas. |
| `slog` | Go structured JSON logs. |
| `testify` | Go test assertions. |
| `oapi-codegen` | Generates Go servers and types from OpenAPI. |
| `openapi-typescript` | Generates TypeScript types and clients from OpenAPI. |
| QStash (as outbox relay) | Delivers events between services. Listed in the SDD stack. |
| Groq | AI provider behind `AiProvider`. Plugged in later, after the owner supplies a key and the tutor design. |
| Playwright | Smoke and end-to-end tests. |

New dependencies must pass the `tool-evaluator` agent first (plan).
