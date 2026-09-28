// HealthGrid - "Platform health": five cards. Database gets a full-width card; Redis,
// QStash, Email and Storage one card each. The status Badge carries the live pulse for
// "ok"; the icon tile changes tone with the status.
// Server-component safe (props only).

import { Badge, Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { DevServiceHealth } from "@/lib/dev-types";
import { formatMs } from "./format";
import { stagger } from "./motion";
import { SERVICE_META, STATUS_TILE, findService } from "./services";
import { ServiceStatusBadge } from "./ServiceStatusBadge";

const CARD =
  "rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost animate-fade-up " +
  "transition-[translate,box-shadow] duration-300 ease-standard hover:-translate-y-0.5 hover:shadow-lift";

function Latency({ ms }: { ms: number | null }) {
  if (ms === null) {
    return (
      <span className="text-sm text-muted">
        <span aria-hidden="true">-</span>
        <span className="sr-only">No latency measured</span>
      </span>
    );
  }
  return <span className="text-sm font-semibold text-ink tabular-nums">{formatMs(ms)}</span>;
}

/** Overall verdict for the section header. */
export function healthSummary(services: DevServiceHealth[]): { tone: "active" | "error" | "neutral"; label: string } {
  const down = services.filter((service) => service.status === "down").length;
  if (down > 0) return { tone: "error", label: down === 1 ? "1 service down" : `${down} services down` };
  if (services.some((service) => service.status === "ok")) return { tone: "active", label: "All systems operational" };
  return { tone: "neutral", label: "Nothing to probe yet" };
}

function SingleCard({ service, index, className }: { service: DevServiceHealth; index: number; className?: string }) {
  const meta = SERVICE_META[service.key];
  return (
    <article className={cn(CARD, className)} style={stagger(index)}>
      <div className="flex items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", STATUS_TILE[service.status])}>
          <Icon icon={meta.icon} width={20} />
        </span>
        <h3 className="min-w-0 truncate font-display text-base font-semibold text-ink">{meta.name}</h3>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <ServiceStatusBadge status={service.status} />
        <Latency ms={service.latencyMs} />
      </div>
    </article>
  );
}

/** `startAt` offsets the stagger so the grid follows the elements above it. */
export function HealthGrid({ services, startAt = 0 }: { services: DevServiceHealth[]; startAt?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SingleCard service={findService(services, "database")} index={startAt} className="sm:col-span-2" />
      <SingleCard service={findService(services, "redis")} index={startAt + 1} />
      <SingleCard service={findService(services, "qstash")} index={startAt + 2} />
      <SingleCard service={findService(services, "email")} index={startAt + 3} />
      <SingleCard service={findService(services, "storage")} index={startAt + 4} />
    </div>
  );
}

/** Small "all good / problem" chip for the section header. */
export function HealthSummaryBadge({ services }: { services: DevServiceHealth[] }) {
  const { tone, label } = healthSummary(services);
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
