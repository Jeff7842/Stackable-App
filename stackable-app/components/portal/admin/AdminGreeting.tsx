"use client";

// Greeting card for the admin overview: who, which school, today's date, and a
// quiet "live" status with a manual refresh (the data also refetches by itself
// every minute and on window focus).

import { Badge, Button, Icon } from "@/components/ui";
import { LiveDot } from "./Panel";

export function AdminGreeting({
  greeting,
  firstName,
  roleLabel,
  schoolName,
  dateLabel,
  updatedLabel,
  refreshing,
  onRefresh,
}: {
  greeting: string;
  firstName: string;
  roleLabel: string;
  schoolName: string;
  dateLabel: string;
  /** e.g. "Updated 2m ago"; empty while the clock is not ready. */
  updatedLabel: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <section
      aria-label="Welcome"
      className="animate-fade-up rounded-2xl bg-surface p-6 shadow-soft ring-1 ring-ghost sm:p-7"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Badge tone="gold" icon="solar:shield-check-linear">
            {roleLabel}
          </Badge>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h2>
          <ul className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-soft">
            {schoolName ? (
              <li className="inline-flex min-w-0 items-center gap-1.5">
                <Icon icon="solar:buildings-2-linear" width={16} className="shrink-0 text-muted" />
                <span className="truncate">{schoolName}</span>
              </li>
            ) : null}
            {dateLabel ? (
              <li className="inline-flex items-center gap-1.5">
                <Icon icon="solar:calendar-linear" width={16} className="shrink-0 text-muted" />
                <span>{dateLabel}</span>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <p className="flex items-center gap-2 text-xs font-medium text-ink-soft" aria-live="polite">
            <LiveDot />
            <span>{updatedLabel ? `Live · ${updatedLabel}` : "Live"}</span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            leftIcon="solar:refresh-linear"
            loading={refreshing}
            onClick={onRefresh}
            aria-label="Refresh overview"
          >
            Refresh
          </Button>
        </div>
      </div>
    </section>
  );
}
