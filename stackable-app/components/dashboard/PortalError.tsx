"use client";

// Error boundary for every portal: friendly message, a retry button and a reference code for support.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button, EmptyState } from "@/components/ui";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
      <EmptyState
        className="py-20"
        icon="solar:danger-triangle-linear"
        title="This page hit a problem"
        description={`Try again. If it keeps happening, tell support${error.digest ? ` and quote ${error.digest}` : ""}.`}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  );
}
