# academics

Homework, CATs and grading for Stackable. TypeScript, Hono via `@stackable/service-kit`, Postgres schema `academics`.
Default port 4002. Contract: `packages/contracts/openapi/academics.yaml`.

This schema is new and separate from the legacy Prisma tables in the web app (`assessments` there stay owned by the web app for now).

## Run

```
pnpm --filter @stackable/academics dev       # in-memory store when DATABASE_URL is unset
pnpm --filter @stackable/academics typecheck
pnpm test                                    # from the repo root
```

Environment: `SERVICE_TOKEN_SECRET` (32+ chars, required), `DATABASE_URL` (required in production), `PORT`.
Migrations (goose): `services/academics/migrations`, applied by the owner role. The app role must not bypass RLS.

## Layout

```
src/app.ts                  wires routes under /v1 behind the service token
src/features/homework       assignments, submissions, review, parent read model
src/features/cats           assessments, attempts, marking, deadline worker
src/features/grading        pure band maths, systems, results, release
src/store                   Repo contract, in-memory store, pg store, table registry
src/lib                     validation kit, auth/actor, outbox, clock
```

Every request runs `store.tx(schoolId, ...)`: one transaction with `app.school_id` set, so RLS applies. Repos also filter `school_id` themselves.

## Rules worth knowing

- Roles read from the token: `teacher`, `admin`, `student`/`pupil`, `parent`, `ai`/`service`. Admin also passes teacher checks.
- Answer keys, correct flags and calculation specs are never returned by student or parent endpoints.
- Homework: a submission after `closes_at` is accepted and flagged `late`. Submit is refused (409 `HOMEWORK_AI_GATE_LOCKED`) while any answer has `ai_gate_locked`, which the ai service sets via `POST /v1/answers/{id}/gate`.
- Parent read model: AI usage counts are passed by the caller (`aiHints`, `aiPractice` query params) and echoed. The gateway must verify the parent-child link before calling.
- Student list/open/start need `classId` from the gateway (class membership is not owned here).
- CATs: the deadline is `start + duration + accommodation` from the server clock. Autosave after the deadline is refused; `autoSubmitDue(store, now)` closes expired attempts.
- Marking: multiple choice, reorder and calculation are auto-marked, all or nothing per question. A paper with no teacher-marked answers is graded on submit if a grading system is active.
- Grading bands cover 0 to 100 on the finest decimal grid used (whole-number bands: 79 then 80 is contiguous). A percentage is rounded to that grid before lookup.
- Release: `POST /v1/assessments/{id}/release` needs the service-token claim `rel: true`. The web gateway sets it only after verifying the school security code and enforcing the 5-try lockout. A token without it can never release. It refuses while the window is open or any script is unmarked, then sets `released_at` on all results, marks the assessment RELEASED and writes outbox `results.released` in one transaction.
- Outbox: `assignment.published`, `results.released`. Relaying rows (`published_at is null`) is done elsewhere.

## Operations

- Run the deadline sweep from one instance only (`main.ts` runs it every 15 s). It reads school ids through the security-definer function `academics.due_attempt_school_ids`, the only cross-tenant read.
- Scan upload links return a placeholder key and `uploadUrl: null`; real signing lives in the documents service.

## Not done here

- Migrations were not applied to a database in this session; SQL is checked against the table registry by `src/store/pg.test.ts`.
- DB role grants and column grants for answer keys belong to the database work (D10).
