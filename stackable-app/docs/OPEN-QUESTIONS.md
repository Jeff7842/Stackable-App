# Open questions

Items that need an owner answer.
Each states what blocks on it.

## Decided

| Question | Answer | Date |
|---|---|---|
| Late homework submissions | Flag as late, accept. Do not block. | 2026-10-04 (plan default; confirm at approval) |

## Open: owner decisions

1. **Groq key and tutor design.** AI runs on a fake provider until both arrive. Blocks D8-9 Groq wiring.
2. **Daraja B2C onboarding per school.** Blocks payroll and payouts (Week 4).
3. **Refund automation vs authorization (H13).** The 12 h event auto-refund contradicts "no payout without authorization". Blocks Week 3 events.
4. **Super Admin payroll role (H13).** Cross-tenant "pay salary" needs a rule. Blocks Week 4.
5. **Exam model (H17).** Proposal: `assessments` stays CAT, quiz, RAT, and exams get their own tables. Needs an ADR before Week 6.
6. **Neon test branch URL.** Needed to run migrations and RLS tests without touching main data.
7. **Day-end commits.** Commit locally at each green gate, or leave the tree commit-ready?

## Open: gaps the docs agent could not fill

8. **Security code regeneration (H21).** Decide the data model for a version counter before building "regenerate".
9. **Role mapping (H3).** How do the SDD's 9 roles map onto the repo's 8? Source not read in this change.
10. **Error envelope in new services.** [ADR-004](DECISIONS/ADR-004-error-envelope.md) keeps `error`. Confirm `service-kit` and `go-kit` mirror it.
11. **`OTP_HASH_SECRET` fallback.** `lib/auth/otp.ts` still falls back to `BETTER_AUTH_SECRET`. `lib/env.ts` requires both. Remove the fallback?
12. **Why Vitest over Jest.** No reason is recorded in the plan or repo.
13. **Fail-closed scope.** Production only today. Confirm staging should fail closed too.
14. **R2 wiring.** The S3 SDK is installed. No R2 code was found in the files read. Status unverified.
