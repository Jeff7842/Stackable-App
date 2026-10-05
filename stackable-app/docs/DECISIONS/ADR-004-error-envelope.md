# ADR-004: Keep the existing error envelope and add `requestId`

- Date: 2026-10-04
- Status: accepted

## Context

The plan text defines the envelope as `{ code, message, requestId, details? }`.
The existing contract in `stackable-app/lib/api/errors.ts` is `{ error, code, details }`.
The field `error` holds the human message.
Existing clients read `error`.

## Decision

Keep `{ error, code, details }`.
Add `requestId` to the body and an `x-request-id` header.
Unknown errors return `{ error: "Something went wrong.", code: "INTERNAL", requestId }` with status 500.

Example (from `toErrorResponse`):

```json
{
  "error": "Too many requests. Please slow down.",
  "code": "RATE_LIMITED",
  "details": null,
  "requestId": "6f0c7a52-0a0e-4c3a-9d55-2f6a3c0c1b11"
}
```

## Why

The existing contract wins over the plan text.
Renaming `error` to `message` breaks every caller for no gain.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Switch to `message` (plan text) | Breaks existing callers. |
| Send both `error` and `message` | Two names for one thing. Not chosen. |

## Consequences

- New services (Go and TypeScript) must emit the same shape so the gateway handles one envelope.
- Stable codes in use today: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `RATE_LIMITED`, `UNAVAILABLE`, `INTERNAL`.
- Open: whether `service-kit` and `kyfaru-kit` mirror `error` or the plan's `message`. Decide before the first contract is published.
