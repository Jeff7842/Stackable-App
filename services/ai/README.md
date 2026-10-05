# @stackable/ai

AI tutor service (TypeScript, Hono). Hints, the answer gate, practice sets, parent usage counts and study tools. Contract: `packages/contracts/openapi/ai.yaml`. Default port 4003.

## Run

```
pnpm --filter @stackable/ai dev        # tsx watch
pnpm --filter @stackable/ai typecheck
pnpm test                              # from the repo root
```

| Env | Meaning |
|---|---|
| `SERVICE_TOKEN_SECRET` | Shared HS256 secret (32+ chars) |
| `DATABASE_URL` | Postgres; without it the in-memory store is used (dev only, required in production) |
| `GROQ_API_KEY`, `GROQ_MODEL` | Switches from the fake provider to Groq once the key is set |
| `AI_PROVIDER=fake` | Forces the fake provider even when a key exists |
| `PORT` | Default 4003 |

## Layout

- `gate.ts`, `allowance.ts`, `tutorGuard.ts`, `points.ts`, `policy.ts`: pure modules, no I/O, fully tested.
- `provider.ts`, `fakeProvider.ts`, `groqProvider.ts`: the `AiProvider` interface and its two implementations.
- `store.ts` (interface and in-memory), `pgStore.ts` (Postgres via `withSchool`), `service.ts` (use cases), `app.ts` (routes, validation, roles).
- `migrations/`: goose SQL, schema `ai`, RLS on `school_id` for every table.

## Answer gate (SDD P2-12)

States: OPEN, ASSISTED (hints 1 to cap), PRACTICE_REQUIRED, PRACTICE_OPEN, DONE, LOCKED_REDO. Limits come from `AiPolicy` (`hintsPerQuestion` 3, `practiceItems` 5, points, base allowance), never from constants. `locked(state)` is true for PRACTICE_REQUIRED, PRACTICE_OPEN and LOCKED_REDO; the academics service must not unlock later content while it is true.

## Rules the service enforces

- Answer keys: only teacher and system tokens may send `answerKey` (hint) or `correct` (gate). It is used for the leak check and never stored in `ai_messages` or returned. Practice keys live in `ai.practice_items.answer_key` and are never returned.
- Every provider reply is leak-checked; a leak is regenerated once with the rewrite prompt, then replaced by a safe hint.
- Provider failure returns 502 `UPSTREAM_FAILED` with a friendly message and does not spend the hint.
- Allowance: AI replies per school-local day (UTC+3) against a limit from the points tier. Over the limit returns 429 `AI_ALLOWANCE_EXHAUSTED`. A tier never changes the hint cap.
- `GET /v1/usage/summary` returns counts and points only. The gateway must check the parent-child link before calling it.
- Study tools are always `aiGenerated: true, needsTeacherReview: true`. Quiz answers are returned to teacher and system tokens only.

## Errors

Standard envelope `{ error, code, details, requestId }`. Codes used here besides the service-kit ones: `AI_ALLOWANCE_EXHAUSTED` (429), `AI_OUTPUT_INVALID` (502).

## Not covered by tests

`pgStore.ts` and the migration have not been run against a database in this environment.
