# ADR-002: Keep the web app in `stackable-app/`

- Date: 2026-10-04
- Status: accepted

## Context

The plan places the Next.js app at `apps/web`.
The app currently lives in `stackable-app/`.
Moving it changes many paths: Sentry config, Prisma config, and imports.

## Decision

Keep the app in `stackable-app/` for now.
The root `pnpm-workspace.yaml` lists `stackable-app`, `packages/*` and `services/*`.
Revisit the move later.

## Why

Avoid mass path churn.
The move adds risk and gives no feature on its own.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Move to `apps/web` now (the plan) | Path churn across Sentry, Prisma and imports during the busiest week. |

## Consequences

- Tooling uses `stackable-app` in filters, for example `pnpm --filter stackable-app check`.
- The CI workflow sits at the repo root with `working-directory: stackable-app` (warning H19).
- The plan text says `apps/web`. Read it as `stackable-app/`.
- A later move is still possible. It is one mechanical change when the repo is quiet.
