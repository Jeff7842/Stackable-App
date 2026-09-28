import * as Sentry from "@sentry/nextjs";

// Next.js calls register() once per server process, on both the Node and Edge
// runtimes. It loads the matching Sentry config (never the client one - that
// runs in the browser via sentry.client.config.ts + instrumentation-client.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reports errors from nested React Server Components. A no-op if Sentry was
// never init'd (no DSN configured).
export const onRequestError = Sentry.captureRequestError;
