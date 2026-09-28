"use client";

// =============================================================================
// IntegrationsView - /dev/integrations. Status cards only, from
// DevOverview.services. Never a key, URL or secret: this component only ever
// receives { key, status, configured, latencyMs }.
// =============================================================================

import { Button, Icon } from "@/components/ui";
import { useDevOverview } from "@/hooks/useDevOverview";
import { cn } from "@/lib/cn";
import { DevIntro } from "./DevIntro";
import { ErrorPanel } from "./ErrorPanel";
import { formatMs } from "./format";
import { stagger } from "./motion";
import { RelativeTime } from "./RelativeTime";
import { INTEGRATION_ORDER, SERVICE_META, STATUS_TILE, findService } from "./services";
import { ServiceStatusBadge } from "./ServiceStatusBadge";
import { CardGridSkeleton } from "./skeletons";

export function IntegrationsView() {
  const overview = useDevOverview();
  const data = overview.data;

  const refresh = (
    <div className="flex items-center gap-3">
      {data ? (
        <span className="text-xs text-muted">
          Checked <RelativeTime iso={data.generatedAt} className="tabular-nums" />
        </span>
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        leftIcon="solar:refresh-linear"
        loading={overview.isFetching}
        onClick={() => void overview.refetch()}
      >
        Refresh
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <DevIntro
        subtitle="Live status of the services the platform depends on. Health checks are cached for about 30 seconds; secrets are never shown here."
        actions={refresh}
      />

      {overview.isPending ? (
        <CardGridSkeleton count={INTEGRATION_ORDER.length} />
      ) : !data ? (
        <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
          <ErrorPanel error={overview.error} onRetry={() => void overview.refetch()} retrying={overview.isFetching} />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {INTEGRATION_ORDER.map((key, index) => {
            const meta = SERVICE_META[key];
            const service = findService(data.services, key);
            return (
              <li
                key={key}
                style={stagger(index + 1)}
                className={cn(
                  "flex flex-col rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost animate-fade-up",
                  "transition-[translate,box-shadow] duration-300 ease-standard hover:-translate-y-0.5 hover:shadow-lift",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", STATUS_TILE[service.status])}>
                    <Icon icon={meta.icon} width={22} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-semibold text-ink">{meta.name}</h2>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{meta.purpose}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  <ServiceStatusBadge status={service.status} />
                  <span className="text-sm text-muted">
                    Latency{" "}
                    <span className="font-semibold text-ink tabular-nums">
                      {service.latencyMs === null ? "-" : formatMs(service.latencyMs)}
                    </span>
                  </span>
                </div>

                {key === "redis" ? (
                  <p className="mt-4 rounded-xl bg-recessed p-3 text-xs leading-relaxed text-ink-soft">
                    Caching and rate limits activate automatically once Upstash keys are set.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
