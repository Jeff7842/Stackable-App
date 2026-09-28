"use client";

// =============================================================================
// OverviewView - /dev. The platform at a glance.
//
//   greeting + live stamp
//   KPI strip ........ Schools, Users, Active sessions, Audit events (24h)
//   left column ...... Platform health (Database, Redis, QStash, Email, Storage)
//   right rail (xl) .. Users by role donut, Latest activity   (stacked on phones)
//
// Data: useDevOverview (polls every 30s, keeps the last numbers while refreshing).
// The Navbar owns the <h1> ("Overview"); the greeting below is an <h2>.
// =============================================================================

import { useMemo } from "react";
import { Button, Icon } from "@/components/ui";
import StatCard from "@/components/cards/card";
import { displayName } from "@/components/dashboard/format";
import { useDevOverview } from "@/hooks/useDevOverview";
import { useMe } from "@/hooks/useMe";
import { cn } from "@/lib/cn";
import { ActivityCard } from "./ActivityCard";
import { ErrorPanel } from "./ErrorPanel";
import { greetingFor } from "./format";
import { HealthGrid, HealthSummaryBadge } from "./HealthGrid";
import { stagger } from "./motion";
import { RelativeTime } from "./RelativeTime";
import { RolesCard } from "./RolesCard";
import { OverviewSkeleton } from "./skeletons";
import { useNow } from "./useNow";

export function OverviewView() {
  const overview = useDevOverview();
  const me = useMe();
  const now = useNow();

  const greeting = useMemo(() => {
    if (!me.data || !now) return "Welcome back";
    const name = me.data.firstName?.trim() || displayName(me.data);
    return `${greetingFor(new Date(now).getHours())}, ${name}`;
  }, [me.data, now]);

  if (overview.isPending) return <OverviewSkeleton />;

  if (overview.isError && !overview.data) {
    return (
      <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
        <ErrorPanel error={overview.error} onRetry={() => void overview.refetch()} retrying={overview.isFetching} />
      </div>
    );
  }

  const data = overview.data;
  if (!data) return <OverviewSkeleton />;

  const { counts, services } = data;
  const refreshFailed = overview.isRefetchError;

  const kpis = [
    { label: "Schools", value: counts.schools, icon: "solar:buildings-2-linear", tone: undefined },
    { label: "Users", value: counts.users, icon: "solar:users-group-two-rounded-linear", tone: { bg: "bg-info-tint", fg: "text-info" } },
    { label: "Active sessions", value: counts.activeSessions, icon: "solar:shield-user-linear", tone: { bg: "bg-success-tint", fg: "text-success" } },
    // The one gold tile on the page: the audit trail is what a developer should never lose sight of.
    { label: "Audit events (24h)", value: counts.auditEvents24h, icon: "solar:history-linear", tone: { bg: "bg-accent-tint", fg: "text-accent-ink" } },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting + live stamp */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{greeting}</h2>
          <p className="mt-1 text-sm text-ink-soft">Here is how the platform looks right now.</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            role="status"
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
              refreshFailed ? "bg-danger-tint text-danger" : "bg-recessed text-ink-soft",
            )}
          >
            <span aria-hidden="true" className="relative inline-flex size-2">
              {!refreshFailed ? <span className="absolute inset-0 rounded-full bg-success animate-pulse-dot" /> : null}
              <span className={cn("relative size-2 rounded-full", refreshFailed ? "bg-danger" : "bg-success")} />
            </span>
            {refreshFailed ? (
              "Connection lost, showing the last data"
            ) : (
              <span>
                {overview.isFetching ? "Updating" : "Updated"} <RelativeTime iso={data.generatedAt} className="tabular-nums" />
              </span>
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            leftIcon="solar:refresh-linear"
            aria-label="Refresh overview"
            loading={overview.isFetching}
            onClick={() => void overview.refetch()}
          />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, index) => (
          <div key={kpi.label} className="animate-fade-up" style={stagger(index + 1)}>
            <StatCard
              animate
              label={kpi.label}
              value={kpi.value}
              icon={<Icon icon={kpi.icon} width={20} />}
              iconBg={kpi.tone?.bg}
              iconColor={kpi.tone?.fg}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Left: platform health */}
        <section aria-labelledby="dev-health-heading" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 animate-fade-up" style={stagger(5)}>
            <h2 id="dev-health-heading" className="font-display text-lg font-semibold tracking-tight text-ink">
              Platform health
            </h2>
            <HealthSummaryBadge services={services} />
          </div>
          <HealthGrid services={services} startAt={6} />
        </section>

        {/* Right rail (stacked below on phones) */}
        <div className="min-w-0 space-y-6">
          <RolesCard counts={counts} style={stagger(6)} />
          <ActivityCard
            style={stagger(7)}
            summary={`${counts.auditEvents24h.toLocaleString("en-US")} events and ${counts.otpsIssued24h.toLocaleString("en-US")} sign-in codes in the last 24 hours`}
          />
        </div>
      </div>
    </div>
  );
}
