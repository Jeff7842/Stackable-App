"use client";

// ActivityCard - "Latest activity": the 6 newest audit events (useDevAudit
// {pageSize: 6}). Fails on its own: if the audit table is not installed (503) the
// rest of the overview still works and this card shows the server's message.

import type { CSSProperties } from "react";
import { Avatar, Badge, Button, EmptyState, Skeleton } from "@/components/ui";
import { useDevAudit } from "@/hooks/useDevAudit";
import type { DevAuditRow } from "@/lib/dev-types";
import { DevCard } from "./DevCard";
import { ErrorPanel } from "./ErrorPanel";
import { actionLabel, actionTone } from "./format";
import { RelativeTime } from "./RelativeTime";

function Row({ event }: { event: DevAuditRow }) {
  const actor = event.actor.name ?? "Unknown user";
  return (
    <li className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-300 ease-standard hover:bg-recessed">
      <Avatar name={actor} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {actor}
          {event.target ? <span className="font-normal text-muted"> to </span> : null}
          {event.target ? (event.target.name ?? "Unknown user") : null}
        </p>
        <div className="mt-1">
          <Badge tone={actionTone(event.action)} size="sm">
            {actionLabel(event.action)}
          </Badge>
        </div>
      </div>
      <RelativeTime iso={event.createdAt} className="shrink-0 pt-0.5 text-xs text-muted tabular-nums" />
    </li>
  );
}

export function ActivityCard({ summary, style }: { summary?: string; style?: CSSProperties }) {
  const audit = useDevAudit({ pageSize: 6 });
  const items = audit.data?.items ?? [];

  return (
    <DevCard
      title="Latest activity"
      description={summary}
      style={style}
      action={
        <Button as="a" href="/dev/audit" variant="ghost" size="sm" rightIcon="solar:arrow-right-linear">
          View all
        </Button>
      }
    >
      {audit.isPending ? (
        <div aria-busy="true" aria-label="Loading activity" className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3">
              <Skeleton rounded="full" className="size-8 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : audit.isError && !audit.data ? (
        <ErrorPanel compact error={audit.error} onRetry={() => void audit.refetch()} retrying={audit.isFetching} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="solar:history-linear"
          title="No activity yet"
          description="Impersonation events will show up here as they happen."
          className="py-8"
        />
      ) : (
        <ul className="-mx-3 space-y-0.5">
          {items.map((event) => (
            <Row key={event.id} event={event} />
          ))}
        </ul>
      )}
    </DevCard>
  );
}
