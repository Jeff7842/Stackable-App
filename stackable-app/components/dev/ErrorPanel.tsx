"use client";

// =============================================================================
// ErrorPanel - the error state for every dev page / card.
// -----------------------------------------------------------------------------
// Shows the SERVER's message (HttpError.message) so a developer sees, for example,
// "Impersonation tables are not installed. Run db/foundation.sql in the Supabase
// SQL editor." instead of a generic "something went wrong". Network failures
// (fetch throws a TypeError) get a plain connection message. Always offers Retry.
// `compact` is the small left-aligned variant used inside cards.
// =============================================================================

import { HttpError } from "@/lib/api/http";
import { Button, Icon } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Short heading chosen from the HTTP status. */
export function errorTitle(error: unknown): string {
  if (!(error instanceof HttpError)) return "Cannot reach the server";
  switch (error.status) {
    case 400:
      return "Check the details";
    case 401:
      return "Session expired";
    case 403:
      return "Not allowed";
    case 404:
      return "Not found";
    case 409:
      return "Already viewing as someone";
    case 429:
      return "Too many attempts";
    case 501:
      return "Not available here";
    case 503:
      return "Setup needed";
    default:
      return error.status >= 500 ? "Server error" : "Something went wrong";
  }
}

/** The server's own message when there is one; a plain sentence otherwise. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  return "Check your connection and try again.";
}

export function ErrorPanel({
  error,
  onRetry,
  retrying = false,
  compact = false,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const setup = error instanceof HttpError && error.status === 503;
  const icon = setup ? "solar:database-linear" : "solar:danger-triangle-linear";

  return (
    <div
      role="alert"
      className={cn(
        "animate-fade-in",
        compact
          ? "flex items-start gap-3 rounded-xl bg-danger-tint p-4"
          : "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "grid shrink-0 place-items-center text-danger",
          compact ? "size-9 rounded-lg bg-surface" : "mb-5 size-16 rounded-2xl bg-danger-tint",
        )}
      >
        <Icon icon={icon} width={compact ? 20 : 30} />
      </div>
      <div className={cn("min-w-0", compact ? "flex-1" : "max-w-md")}>
        <h3 className={cn("font-display font-semibold text-ink", compact ? "text-sm" : "text-lg")}>{errorTitle(error)}</h3>
        <p className={cn("mt-1 leading-relaxed text-ink-soft", compact ? "text-xs" : "text-sm")}>{errorMessage(error)}</p>
        {onRetry ? (
          <Button
            variant="secondary"
            size="sm"
            leftIcon="solar:refresh-linear"
            loading={retrying}
            onClick={onRetry}
            className={compact ? "mt-3" : "mt-5"}
          >
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}
