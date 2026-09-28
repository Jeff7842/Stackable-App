/**
 * Capacity display for one user category (users, students, teachers ...).
 *
 *   <CapacityCell actual={120} expected={200} />           compact: table cell / card fact
 *   <CapacityMeter label="Students" actual={120} expected={200} />   large: drawer tab
 *
 * Colour follows the old page's thresholds (see capacityLevel): <=50% good,
 * <=70% steady, <=90% high, above 90% critical (also gets a warning icon).
 * Tokens only. The bar animates from 0 on first paint (`starting:` variant);
 * reduced motion turns the transition off globally.
 */
import type { CSSProperties } from "react";
import { AnimatedNumber, Badge, Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import { capacityLevel, capacityPercent, type CapacityLevel } from "./utils";

const TEXT: Record<CapacityLevel, string> = {
  none: "text-muted",
  good: "text-success",
  steady: "text-ink",
  high: "text-warning",
  critical: "text-danger",
};

const BAR: Record<CapacityLevel, string> = {
  none: "bg-field",
  good: "bg-success",
  steady: "bg-primary",
  high: "bg-warning",
  critical: "bg-danger",
};

function Bar({ actual, expected, level }: { actual: number; expected: number; level: CapacityLevel }) {
  const width = `${Math.min(100, Math.max(0, capacityPercent(actual, expected)))}%`;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-field" aria-hidden="true">
      {/* width comes from a CSS variable so `starting:w-0` can animate the first paint */}
      <div
        style={{ "--fill": width } as CSSProperties}
        className={cn(
          "h-full w-(--fill) rounded-full transition-[width] duration-700 ease-standard starting:w-0",
          BAR[level],
        )}
      />
    </div>
  );
}

export function CapacityCell({ actual, expected }: { actual: number; expected: number }) {
  const level = capacityLevel(actual, expected);
  const pct = Math.round(capacityPercent(actual, expected));

  if (level === "none") {
    return (
      <div className="min-w-[4.5rem]" title="No capacity set">
        <span className="font-semibold tabular-nums text-ink-soft">{actual}</span>
        <span className="ml-1 text-xs text-muted">/ —</span>
      </div>
    );
  }

  return (
    <div className="min-w-[4.5rem]" title={`${actual} of ${expected} used (${pct}%)`}>
      <div className={cn("flex items-center gap-1 font-semibold tabular-nums", TEXT[level])}>
        {level === "critical" ? <Icon icon="solar:danger-triangle-linear" width={14} className="shrink-0" /> : null}
        <span>{actual}</span>
        <span className="text-xs font-medium text-muted">/ {expected}</span>
      </div>
      <div className="mt-1.5">
        <Bar actual={actual} expected={expected} level={level} />
      </div>
    </div>
  );
}

export function CapacityMeter({ label, actual, expected }: { label: string; actual: number; expected: number }) {
  const level = capacityLevel(actual, expected);
  const pct = Math.round(capacityPercent(actual, expected));

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost transition-[translate,box-shadow] duration-300 ease-standard hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</p>
        {level === "critical" ? (
          <Badge tone="error" size="sm" icon="solar:danger-triangle-linear">
            Near limit
          </Badge>
        ) : null}
      </div>

      <p className={cn("mt-2 font-display text-2xl font-semibold tabular-nums", level === "none" ? "text-ink-soft" : "text-ink")}>
        <AnimatedNumber value={actual} />
        <span className="ml-1 text-sm font-medium text-muted">/ {expected > 0 ? expected : "—"}</span>
      </p>

      <div className="mt-3">
        <Bar actual={actual} expected={expected} level={level} />
      </div>
      <p className={cn("mt-1.5 text-xs font-medium tabular-nums", TEXT[level])}>
        {level === "none" ? "No capacity set" : `${pct}% used`}
      </p>
    </div>
  );
}
