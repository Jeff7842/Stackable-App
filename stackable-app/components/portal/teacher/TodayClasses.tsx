"use client";

// "Today's classes": one tone-shifted row per timetable slot. The slot that is
// running right now gets a pulsing live dot and a primary-tint background; the
// next one is marked "Up next"; finished ones fade. `nowMin` is minutes since
// midnight in Nairobi, or null before the client clock is ready.

import type { CSSProperties } from "react";
import { Badge, Button, Icon } from "@/components/ui";
import type { LessonSlot, TodaySchedule } from "@/lib/repositories/portal-types";
import { cn } from "@/lib/cn";
import { isBreakSlot, lessonPhase, lessonTitle, type LessonPhase } from "./helpers";
import { Panel, PanelEmpty, stagger } from "./Panel";

function StatusChip({ phase, isNext }: { phase: LessonPhase; isNext: boolean }) {
  if (phase === "now") {
    return (
      <Badge tone="active" dot size="sm">
        Now
      </Badge>
    );
  }
  if (phase === "upcoming" && isNext) {
    return (
      <Badge tone="gold" size="sm">
        Up next
      </Badge>
    );
  }
  if (phase === "done") return <span className="text-xs font-medium text-muted">Done</span>;
  return null;
}

function LessonRow({ slot, phase, isNext, index }: { slot: LessonSlot; phase: LessonPhase; isNext: boolean; index: number }) {
  const breakSlot = isBreakSlot(slot);
  const now = phase === "now";

  return (
    <li
      aria-current={now ? "time" : undefined}
      style={stagger(index, 50)}
      className={cn(
        "flex animate-fade-up items-center gap-4 rounded-xl p-3 transition-[background-color,opacity] duration-300 ease-standard",
        now ? "bg-primary-tint" : "bg-recessed/60",
        phase === "done" && "opacity-60",
      )}
    >
      <div className="w-14 shrink-0 tabular-nums">
        <p className="text-sm font-semibold text-ink">{slot.startTime}</p>
        <p className="text-xs text-muted">{slot.endTime}</p>
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-display text-[0.95rem] font-semibold text-ink">
          {breakSlot ? <Icon icon="solar:cup-hot-linear" width={16} className="shrink-0 text-muted" /> : null}
          <span className="truncate">{lessonTitle(slot)}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-soft">
          {slot.className ? (
            <span className="inline-flex items-center gap-1">
              <Icon icon="solar:widget-2-linear" width={14} className="text-muted" />
              {slot.className}
            </span>
          ) : null}
          {slot.room ? (
            <span className="inline-flex items-center gap-1">
              <Icon icon="solar:map-point-linear" width={14} className="text-muted" />
              {slot.room}
            </span>
          ) : null}
        </p>
      </div>

      <div className="shrink-0">
        <StatusChip phase={phase} isNext={isNext} />
      </div>
    </li>
  );
}

export function TodayClasses({
  today,
  nowMin,
  className,
  style,
}: {
  today: TodaySchedule;
  nowMin: number | null;
  className?: string;
  style?: CSSProperties;
}) {
  const lessons = today.lessons;
  const phases = lessons.map((slot) => lessonPhase(slot, nowMin));
  const nextIndex = phases.indexOf("upcoming");
  // Only mark "Up next" when nothing is running, so the two chips never compete.
  const showNext = !phases.includes("now");

  return (
    <Panel
      title="Today's classes"
      description={
        lessons.length > 0
          ? `${today.weekday ? `${today.weekday}, ` : ""}${lessons.length} ${lessons.length === 1 ? "slot" : "slots"} on your timetable`
          : today.weekday || undefined
      }
      className={className}
      style={style}
      action={
        <Button as="a" href="/teach/timetable" variant="ghost" size="sm" rightIcon="solar:arrow-right-linear">
          Timetable
        </Button>
      }
    >
      {lessons.length === 0 ? (
        <PanelEmpty icon="solar:sun-2-linear">No lessons scheduled today - enjoy the breathing room</PanelEmpty>
      ) : (
        <ol className="space-y-2">
          {lessons.map((slot, i) => (
            <LessonRow
              key={slot.id}
              slot={slot}
              phase={phases[i]}
              isNext={showNext && i === nextIndex}
              index={i}
            />
          ))}
        </ol>
      )}
    </Panel>
  );
}
