"use client";

// AuditDrawer - the full record of one audit event: who, what, where, plus the
// metadata as pretty-printed JSON in a recessed mono block (bounded height, scrolls).
// Ids, IP and the metadata have copy buttons.

import { Badge, Drawer, Button } from "@/components/ui";
import type { DevAuditActor, DevAuditRow } from "@/lib/dev-types";
import { CopyButton } from "./CopyButton";
import { actionLabel, actionTone, formatDateTime, roleLabel } from "./format";
import { InfoBlock } from "./InfoBlock";
import { RelativeTime } from "./RelativeTime";

function Person({ person }: { person: DevAuditActor | null }) {
  if (!person) return <span className="font-normal text-muted">None</span>;
  return (
    <span>
      {person.name ?? "Unknown user"}
      {person.role ? <span className="ml-2 text-xs font-medium text-muted">{roleLabel(person.role)}</span> : null}
    </span>
  );
}

/** JSON for the metadata block; never throws (a circular value would fall back to a message). */
function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return "Metadata could not be displayed.";
  }
}

export function AuditDrawer({
  event,
  open,
  onClose,
}: {
  event: DevAuditRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const metadata = event && Object.keys(event.metadata ?? {}).length > 0 ? prettyJson(event.metadata) : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={event ? actionLabel(event.action) : "Audit event"}
      subtitle={event ? formatDateTime(event.createdAt) : undefined}
      size="lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      {event ? (
        <div className="space-y-5">
          <section className="flex flex-wrap items-center gap-3 rounded-2xl bg-recessed p-4">
            <Badge tone={actionTone(event.action)}>{actionLabel(event.action)}</Badge>
            <span className="font-mono text-xs text-ink-soft">{event.action}</span>
            <RelativeTime iso={event.createdAt} className="ml-auto text-xs text-muted tabular-nums" />
          </section>

          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoBlock label="Actor">
              <Person person={event.actor} />
            </InfoBlock>
            <InfoBlock label="Target">
              <Person person={event.target} />
            </InfoBlock>
            <InfoBlock label="School" wide>
              {event.schoolName ?? <span className="font-normal text-muted">None</span>}
            </InfoBlock>
            <InfoBlock label="Method">{event.method ?? "-"}</InfoBlock>
            <InfoBlock label="IP address" mono copy={event.ipAddress ?? undefined}>
              {event.ipAddress ?? "-"}
            </InfoBlock>
            <InfoBlock label="Path" mono wide copy={event.path ?? undefined}>
              {event.path ?? "-"}
            </InfoBlock>
            <InfoBlock label="User agent" mono wide copy={event.userAgent ?? undefined}>
              {event.userAgent ?? "-"}
            </InfoBlock>
            <InfoBlock label="Actor ID" mono copy={event.actor.id}>
              {event.actor.id}
            </InfoBlock>
            <InfoBlock label="Target ID" mono copy={event.target?.id}>
              {event.target?.id ?? "-"}
            </InfoBlock>
            <InfoBlock label="Event ID" mono wide copy={event.id}>
              {event.id}
            </InfoBlock>
          </dl>

          <section aria-labelledby="audit-metadata-heading">
            <div className="mb-2 flex items-center justify-between">
              <h3 id="audit-metadata-heading" className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Metadata
              </h3>
              {metadata ? <CopyButton value={metadata} label="metadata" /> : null}
            </div>
            {metadata ? (
              <pre
                tabIndex={0}
                className="max-h-72 overflow-auto rounded-xl bg-recessed p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-ink-soft focus-visible:outline-2 focus-visible:outline-focus"
              >
                {metadata}
              </pre>
            ) : (
              <p className="rounded-xl bg-recessed p-4 text-sm text-muted">This event has no extra metadata.</p>
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
