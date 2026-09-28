"use client";

// Next.js renders this ONLY when an error escapes the root layout itself (a normal
// page error is caught by the nearer error.tsx boundaries instead). It must render
// its own <html>/<body> because the root layout is what failed.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "48px", textAlign: "center" }}>
        <h1 style={{ fontSize: "22px", marginBottom: "8px" }}>Something went wrong</h1>
        <p style={{ color: "#666" }}>The team has been notified. Please refresh the page.</p>
      </body>
    </html>
  );
}
