# ADR-003: Defer the Membership table

- Date: 2026-10-04
- Status: accepted

## Context

The SDD has a `Membership` table: one person, many roles.
The repo has one `users` row per school.
This is warning H2 in the plan.

## Decision

Do not build `Membership` now.
Keep one `users` row per school.

## Why

The current model is enough for the pilot (YAGNI).

## Alternatives considered

| Option | Why rejected |
|---|---|
| Build `Membership` now | Not needed for the pilot. It changes identity, guards and every school-scoped query. |

## Consequences

- A person in two schools has two `users` rows.
- Revisit when a real user needs one login across several roles or schools.
- Role list changes (H3) are made on the existing `users.role` column.

## Open

How the SDD's 9 roles map onto the repo's 8 is recorded in OPEN-QUESTIONS.md if unresolved. Not verified in this change.
