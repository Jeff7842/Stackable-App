"use client";

// =============================================================================
// Shared visual pieces for the student AND parent portals (tokens only, no hex, no
// gradients). Everything here degrades quietly: a missing number renders as a
// friendly note or "-", never as 0 or a blank ring.
//
//   GradeBadge / GradeLetter   letter grade, tone by band (A/B strong, C fair, D-F low)
//   TrendMark                  improving / steady / slipping (letters compared, no numbers)
//   InfoBlock / CountTile      pastel tiles (the "User details" reference look)
//   SummaryTile                small KPI tile (hover lift is fine on small tiles)
//   AttendanceBlock            ring + present/late/absent, or "No attendance recorded yet"
//   GradeMixBlock              donut of how the reports split by band, with legend chips
//   PortalWelcome / FocusBlock greeting card shared by the student and parent homes
// =============================================================================

import { useMemo, type ReactNode } from "react";
import { Badge, Icon } from "@/components/ui";
import { DonutChart, RingChart, useChartTheme } from "@/components/ui/Chart";
import { cn } from "@/lib/cn";
import type { AttendanceSummary } from "@/lib/repositories/portal-types";
import {
  attendanceRate,
  attendanceTone,
  gradeBand,
  gradeTone,
  type GradeBand,
  type GradeMix,
  type Trend,
} from "./helpers";
import { LiveDot, PanelEmpty, stagger } from "./Panel";

// ---- Tints ---------------------------------------------------------------------
export type Tint = "primary" | "info" | "accent" | "success" | "warning" | "danger";

/** Tint pairs: soft background + readable ink (both come from tokens, both flip in dark mode). */
export const TINT: Record<Tint, { bg: string; ink: string }> = {
  primary: { bg: "bg-primary-tint", ink: "text-primary-ink" },
  info: { bg: "bg-info-tint", ink: "text-info" },
  accent: { bg: "bg-accent-tint", ink: "text-accent-ink" },
  success: { bg: "bg-success-tint", ink: "text-success" },
  warning: { bg: "bg-warning-tint", ink: "text-warning" },
  danger: { bg: "bg-danger-tint", ink: "text-danger" },
};

const BAND_TINT: Record<GradeBand, Tint> = { top: "success", fair: "info", low: "danger", unknown: "primary" };

export function bandTint(grade: string | null | undefined): Tint {
  return BAND_TINT[gradeBand(grade)];
}

// ---- Grade chips ---------------------------------------------------------------
/** Small letter chip (Badge). Empty grade renders a quiet "-". */
export function GradeBadge({
  grade,
  size = "sm",
  className,
}: {
  grade: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const g = (grade ?? "").trim();
  if (!g) {
    return (
      <Badge tone="neutral" size={size} className={className}>
        -
      </Badge>
    );
  }
  return (
    <Badge tone={gradeTone(g)} size={size} className={className}>
      {g}
    </Badge>
  );
}

/** Big letter tile for subject cards and the grade summary. */
export function GradeLetter({
  grade,
  className,
}: {
  grade: string | null | undefined;
  className?: string;
}) {
  const g = (grade ?? "").trim();
  const tint = TINT[bandTint(g)];
  return (
    <span
      aria-label={g ? `Grade ${g}` : "No grade yet"}
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-xl font-display text-xl font-semibold tabular-nums",
        g ? cn(tint.bg, tint.ink) : "bg-recessed text-muted",
        className,
      )}
    >
      {g || "-"}
    </span>
  );
}

const TREND_COPY: Record<Trend, { label: string; icon: string; cls: string }> = {
  up: { label: "Improving", icon: "solar:arrow-right-up-linear", cls: "text-success" },
  down: { label: "Slipping", icon: "solar:arrow-right-down-linear", cls: "text-warning" },
  steady: { label: "Steady", icon: "solar:arrow-right-linear", cls: "text-muted" },
};

export function TrendMark({ trend }: { trend: Trend | null }) {
  if (!trend) return null;
  const t = TREND_COPY[trend];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", t.cls)}>
      <Icon icon={t.icon} width={14} />
      {t.label}
    </span>
  );
}

// ---- Pastel tiles ----------------------------------------------------------------
/** Icon + eyebrow label + value on a tinted block (guardian, attendance, term ...). */
export function InfoBlock({
  icon,
  label,
  value,
  tint,
  index = 0,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  tint: Tint;
  index?: number;
}) {
  const t = TINT[tint];
  return (
    <div style={stagger(index, 50)} className={cn("animate-fade-up rounded-2xl p-4", t.bg)}>
      <span className={cn("grid size-9 place-items-center rounded-full bg-surface/70", t.ink)}>
        <Icon icon={icon} width={18} />
      </span>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <div className="mt-0.5 break-words text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

/** Small count on a tinted block (present / late / absent). */
export function CountTile({
  icon,
  label,
  value,
  tint,
}: {
  icon: string;
  label: string;
  value: number;
  tint: Tint;
}) {
  const t = TINT[tint];
  return (
    <div className={cn("rounded-xl px-3 py-2.5", t.bg)}>
      <p className={cn("flex items-center gap-1.5 text-xs font-semibold", t.ink)}>
        <Icon icon={icon} width={14} />
        {label}
      </p>
      <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

/** Small KPI tile: a hover lift is fine here (it is a small tile). */
export function SummaryTile({
  icon,
  label,
  value,
  sub,
  tint,
  index = 0,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tint: Tint;
  index?: number;
}) {
  const t = TINT[tint];
  return (
    <div
      style={stagger(index, 50)}
      className={cn(
        "flex animate-fade-up items-center gap-3 rounded-2xl p-4 transition-[translate,box-shadow] duration-300 ease-standard",
        "hover:-translate-y-0.5 hover:shadow-lift",
        t.bg,
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-surface/70", t.ink)}>
        <Icon icon={icon} width={20} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink-soft">{label}</p>
        <div className="truncate font-display text-xl font-semibold tracking-tight text-ink tabular-nums">{value}</div>
        {sub ? <p className="truncate text-xs text-ink-soft">{sub}</p> : null}
      </div>
    </div>
  );
}

// ---- Attendance ----------------------------------------------------------------
/**
 * Ring + present / late / absent tiles. With no attendance rows it says so instead of
 * drawing an empty ring or "0%". `layout="side"` puts the tiles beside the ring (wide
 * containers); "stack" puts them under it (half-width panels, phones).
 */
export function AttendanceBlock({
  attendance,
  layout = "stack",
  ringHeight = 150,
}: {
  attendance: AttendanceSummary;
  layout?: "stack" | "side";
  ringHeight?: number;
}) {
  const theme = useChartTheme();
  const rate = attendanceRate(attendance);
  if (rate === null) {
    return <PanelEmpty icon="solar:clipboard-check-linear">No attendance recorded yet.</PanelEmpty>;
  }
  const tone = attendanceTone(rate);
  const color = tone === "success" ? theme.success : tone === "warning" ? theme.warning : theme.danger;

  return (
    <div
      className={cn(
        "grid items-center gap-4",
        layout === "side" && "sm:grid-cols-[10rem_minmax(0,1fr)]",
      )}
    >
      <div className="mx-auto w-full max-w-[10rem]">
        <RingChart value={rate} label="Present" color={color} height={ringHeight} />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <CountTile icon="solar:user-check-rounded-linear" label="Present" value={attendance.present} tint="success" />
        <CountTile icon="solar:clock-square-linear" label="Late" value={attendance.late} tint="warning" />
        <CountTile icon="solar:user-cross-rounded-linear" label="Absent" value={attendance.absent} tint="danger" />
      </div>
    </div>
  );
}

// ---- Grade mix -------------------------------------------------------------------
const MIX_ROWS: Array<{ band: GradeBand; label: string; tone: "success" | "info" | "error" | "neutral" }> = [
  { band: "top", label: "Strong", tone: "success" },
  { band: "fair", label: "Fair", tone: "info" },
  { band: "low", label: "Needs support", tone: "error" },
  { band: "unknown", label: "Ungraded", tone: "neutral" },
];

/**
 * Donut of how the reports split into strong / fair / needs-support, with legend chips.
 * Built only from real counts, so it works with letters-only data.
 */
export function GradeMixBlock({
  mix,
  overall,
  height = 170,
  layout = "stack",
}: {
  mix: GradeMix;
  /** Headline letter for the donut centre (falls back to the report count). */
  overall: string | null;
  height?: number;
  layout?: "stack" | "side";
}) {
  const theme = useChartTheme();
  const total = mix.top + mix.fair + mix.low + mix.unknown;
  const data = useMemo(
    () =>
      [
        { label: "Strong", value: mix.top, color: theme.success },
        { label: "Fair", value: mix.fair, color: theme.info },
        { label: "Needs support", value: mix.low, color: theme.danger },
        { label: "Ungraded", value: mix.unknown, color: theme.muted },
      ].filter((d) => d.value > 0),
    [mix.top, mix.fair, mix.low, mix.unknown, theme],
  );

  if (total === 0) {
    return <PanelEmpty icon="solar:chart-square-linear">No grades recorded yet.</PanelEmpty>;
  }

  return (
    <div className={cn("grid items-center gap-4", layout === "side" && "sm:grid-cols-[10rem_minmax(0,1fr)]")}>
      <div className="mx-auto w-full max-w-[10rem]">
        <DonutChart
          data={data}
          centerValue={overall ?? String(total)}
          centerLabel={overall ? "Overall" : total === 1 ? "Report" : "Reports"}
          height={height}
        />
      </div>
      <ul className={cn("flex flex-wrap gap-2", layout === "stack" && "justify-center")}>
        {MIX_ROWS.filter((r) => mix[r.band] > 0).map((r) => (
          <li key={r.band}>
            <Badge tone={r.tone} dot>
              <span className="tabular-nums">{mix[r.band]}</span> {r.label}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Welcome card ----------------------------------------------------------------
export type WelcomeMeta = { icon: string; text: string };

export type Focus = {
  kind: "now" | "next" | "idle";
  /** Eyebrow, e.g. "Happening now". */
  label: string;
  title: string;
  meta: string;
};

/** The small "what is happening now / next" block on the right of the welcome card. */
export function FocusBlock({ focus }: { focus: Focus }) {
  const isNow = focus.kind === "now";
  return (
    <div
      aria-live="polite"
      className={cn(
        "w-full shrink-0 rounded-xl p-4 transition-colors duration-300 ease-standard md:w-64",
        isNow ? "bg-primary-tint" : "bg-recessed",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em]",
          isNow ? "text-primary-ink" : "text-muted",
        )}
      >
        {isNow ? <LiveDot /> : <Icon icon="solar:clock-circle-linear" width={14} />}
        {focus.label}
      </div>
      <p className="mt-2 truncate font-display text-lg font-semibold text-ink">{focus.title}</p>
      <p className="mt-0.5 truncate text-xs text-ink-soft">{focus.meta}</p>
    </div>
  );
}

/**
 * Greeting card: a plain surface card (no gradient). The shell already renders the page
 * <h1>, so the greeting is an h2. `aside` is the optional block on the right.
 */
export function PortalWelcome({
  roleLabel,
  roleIcon,
  greeting,
  name,
  meta,
  aside,
}: {
  roleLabel: string;
  roleIcon: string;
  greeting: string;
  name: string;
  meta: WelcomeMeta[];
  aside?: ReactNode;
}) {
  return (
    <section
      aria-label="Welcome"
      className="animate-fade-up rounded-2xl bg-surface p-6 shadow-soft ring-1 ring-ghost sm:p-7"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <Badge tone="info" icon={roleIcon}>
            {roleLabel}
          </Badge>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {greeting}
            {name ? `, ${name}` : ""}
          </h2>
          <ul className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-soft">
            {meta
              .filter((m) => m.text)
              .map((m) => (
                <li key={m.text} className="inline-flex min-w-0 items-center gap-1.5">
                  <Icon icon={m.icon} width={16} className="shrink-0 text-muted" />
                  <span className="truncate">{m.text}</span>
                </li>
              ))}
          </ul>
        </div>
        {aside}
      </div>
    </section>
  );
}
