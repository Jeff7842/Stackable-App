# Handoff

Update this file at every stop (end of a work block, and before token checkpoint 97%).

Last updated: 2026-10-05 (D2, in progress)

## Status

Phase A, day D1: foundation and auth hardening, partly done.

Done:
- Fail-closed rate limits, no secret fallback, new env schema, request ids on errors.
- Root pnpm workspace, `next-auth` removed, Vitest, `pnpm check`.
- Docs set created in `stackable-app/docs/`.
- D2: staff portal, role-tagged nav, "Soon" tags, demo mode (ADR-005), health and ready endpoints, error and loading pages.

Details: [CHANGELOG.md](CHANGELOG.md).

## Last green gate

- `pnpm check`: all 9 `*.check.ts` files pass (reported by the lead).
- Vitest: tests for ratelimit and school-security exist. Last full result not recorded here.
- Typecheck, lint, migration on a Neon branch, Playwright smoke: not recorded.

## In progress

Per the D1 plan, other agents are working on:
- `packages/service-kit` and `packages/contracts`.
- `services/identity` (TypeScript template).
- `packages/kyfaru-kit` and the Go `services/payments` skeleton.
- Database fixes H5, H6, H7 and RLS.

Their status is not recorded in this file yet.

## Next steps

1. Finish Better Auth and bring `ba_*` into a migration (H1).
2. Fix H5, H6, H7, then add RLS with `withSchool()` (H16).
3. Add the CI workflow at the repo root (H19).
4. Build the service template and contracts.
5. Answer the open items in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

## How to run

Run from the repo root:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm check
```

`pnpm verify` runs typecheck, test and check in order.
Set `SKIP_DB_CHECKS=1` to skip checks that read the real database.
Required secrets: `OTP_HASH_SECRET` and `SCHOOL_SECURITY_CODES_SECRET`. See `stackable-app/.env.example` (not read in this change).

## Known issues

- H21: security codes cannot be regenerated without a version counter. See [WARNINGS.md](WARNINGS.md).
- Codes issued under the old fallback secret will not match.
- `pnpm install` re-resolved dependency versions. Watch for other type changes like the `better-auth` 1.7.x one.
- `lib/storage.ts` still uses Supabase (H10).
