"use client";

// Welcome banner: a plain surface card (no gradient). Left = greeting, teacher,
// school and date. Right = a small "focus" block that answers "what is happening
// right now / next" from today's timetable, computed client-side.

import { Badge, Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import { LiveDot } from "./Panel";

export type Focus = {
  kind: "now" | "next" | "idle";
  /** Eyebrow, e.g. "Happening now". */
  label: string;
  title: string;
  meta: string;
};

export function WelcomeBanner({
  greeting,
  firstName,
  schoolName,
  dateLabel,
  focus,
}: {
  greeting: string;
  firstName: string;
  schoolName: string | null;
  dateLabel: string;
  focus: Focus;
}) {
  const isNow = focus.kind === "now";

  return (
    <section
      aria-label="Welcome"
      className="animate-fade-up rounded-2xl bg-surface p-6 shadow-soft ring-1 ring-ghost sm:p-7"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <Badge tone="info" icon="solar:square-academic-cap-linear">
            Teacher
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
      </div>
    </section>
  );
}
