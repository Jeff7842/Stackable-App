"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button, EmptyState } from "@/components/ui";

export default function RootError({
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
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center bg-canvas px-4 text-ink">
      <EmptyState
        icon="solar:danger-triangle-linear"
        title="Something went wrong"
        description={`Try again. If it keeps happening, tell support${error.digest ? ` and quote ${error.digest}` : ""}.`}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </main>
  );
}
