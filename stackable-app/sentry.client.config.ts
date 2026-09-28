// =============================================================================
// Sentry — browser-side error and performance monitoring.
// -----------------------------------------------------------------------------
// Silently does nothing when NEXT_PUBLIC_SENTRY_DSN is unset (e.g. local dev
// without a Sentry project yet), so this file is always safe to ship.
// =============================================================================

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // A fraction of transactions to trace; 1.0 = all. Lower this once traffic is real.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    // Session Replay: capture almost nothing on ordinary sessions, everything on
    // one that hit an error, so a broken flow can actually be watched back.
    replaysSessionSampleRate: 0.02,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],
  });
}
