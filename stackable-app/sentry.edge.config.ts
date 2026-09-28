// =============================================================================
// Sentry — Edge runtime (proxy.ts, any edge route) monitoring.
// -----------------------------------------------------------------------------
// Silently does nothing when SENTRY_DSN is unset.
// =============================================================================

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  });
}
