# ADR-005: Demo mode with a session cookie and a client-side fetch interceptor

- Date: 2026-10-05
- Status: accepted

## Context

The plan asks for a public `/demo`.
It needs no login.
Its data lives only in the browser session.

## Decision

`/demo` shows a role picker.
Picking a role sets the session cookie `stackable_demo=<role>` (`lib/demo/mode.ts`).
The real portal pages then render with demo data.

How it works:
- `requireRole` in `lib/api/guard.ts` returns `null` for a visitor with a demo cookie and no real session. Its return type is now `AuthContext | null`.
- `proxy.ts` lets the demo cookie through.
- `components/demo/DemoProvider.tsx` replaces `window.fetch`. It answers `/api/*` calls from handlers in `lib/demo/**`.
- Demo data sits in `sessionStorage`. It is gone when the session ends.

## Security note

The cookie opens page shells only.
The real API still returns 401.
Checked with curl on 2026-10-05 (reported by the lead):
- `/api/auth/me` without a session: 401.
- `/teach` with a teacher demo cookie: 200.
- `/staff` with a teacher demo cookie: redirect to `/login`.

`parseDemoRole` accepts only known roles. The cookie value is never trusted as data.

## Alternatives considered

| Option | Why rejected |
|---|---|
| `/demo/...` URL prefix with duplicated routes | Absolute hrefs in the real pages would leak out of the prefix. |
| Seeded demo school with auto-login | Rejected by the owner. |

## Consequences

- Real pages are reused. No second copy of the UI.
- Any page that reads server data directly, not through `fetch`, will not show demo data. The plan flags this as a D2 risk.
- Callers of `requireRole` must handle `null`.
- New API routes need a handler in `lib/demo/**` or the demo shows an error for that call.
