"use client";

/**
 * The read-only tab panels of the school detail drawer:
 *   OverviewTab      profile facts (definition list, like the "User details" reference)
 *   SubscriptionTab  package, statuses, dates, queued changes
 *   CapacityTab      the six capacity meters + "Increase capacity" (+50 users)
 * The Security tab lives in SchoolSecurityTab.tsx.
 */
import type { ReactNode } from "react";
import { Button, Skeleton } from "@/components/ui";
import type { SchoolDetails } from "@/hooks/useSchools";
import { CapacityMeter } from "./CapacityMeter";
import { SchoolStatusBadge, SubscriptionStatusBadge } from "./StatusBadge";
import type { SchoolActions } from "./useSchoolActions";
import { CAPACITY_FIELDS, expiryHint, formatDate } from "./utils";

type Row = { label: string; value: ReactNode };

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">{children}</div>;
}

/** Label / value pairs in two columns; empty values show an em dash. */
function DetailList({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
      {rows.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</dt>
          <dd className="mt-1 text-sm font-medium break-words text-ink">{value || <span className="text-muted">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OverviewTab({ school, loadingExtras }: { school: SchoolDetails; loadingExtras: boolean }) {
  // phone 2 / 3 and location only arrive with the full record, not with the list row.
  const extra = (value: string | null | undefined): ReactNode =>
    loadingExtras ? <Skeleton className="h-4 w-32" /> : value;

  return (
    <Card>
      <DetailList
        rows={[
          { label: "School name", value: school.name },
          { label: "School code", value: <span className="tabular-nums">{school.code}</span> },
          { label: "School number", value: <span className="tabular-nums">#{school.school_id}</span> },
          { label: "Head", value: school.head_name },
          { label: "Owner", value: school.owner_name },
          { label: "Email", value: school.email },
          { label: "Primary phone", value: school.phone_1 },
          { label: "Phone 2", value: extra(school.phone_2) },
          { label: "Phone 3", value: extra(school.phone_3) },
          { label: "Location", value: extra(school.location) },
        ]}
      />
    </Card>
  );
}

export function SubscriptionTab({ school }: { school: SchoolDetails }) {
  const hint = expiryHint(school.subscription_expires_at);

  return (
    <Card>
      <DetailList
        rows={[
          { label: "Package", value: school.subscription_package },
          { label: "Subscription status", value: <SubscriptionStatusBadge status={school.subscription_status} /> },
          { label: "School status", value: <SchoolStatusBadge status={school.status} /> },
          { label: "Started", value: formatDate(school.subscription_started_at) },
          {
            label: "Expires",
            value: (
              <span>
                {formatDate(school.subscription_expires_at)}
                {hint ? (
                  <span className={hint.tone === "danger" ? "ml-2 text-xs text-danger" : "ml-2 text-xs text-warning"}>
                    {hint.text}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            label: "Pending status change",
            value: school.pending_status_change_at ? formatDate(school.pending_status_change_at) : null,
          },
        ]}
      />
    </Card>
  );
}

export function CapacityTab({
  school,
  canWrite,
  actions,
}: {
  school: SchoolDetails;
  canWrite: boolean;
  actions: SchoolActions;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CAPACITY_FIELDS.map((field) => (
          <CapacityMeter
            key={field.id}
            label={field.label}
            actual={school[field.actual]}
            expected={school[field.expected]}
          />
        ))}
      </div>

      {canWrite ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold text-ink">Need more room?</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Adds 50 users and spreads the extra capacity across the school categories.
              </p>
            </div>
            <Button
              variant="secondary"
              leftIcon="solar:users-group-rounded-linear"
              loading={actions.busyId === school.id}
              onClick={() => void actions.increaseCapacity(school)}
            >
              Increase users by 50
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
