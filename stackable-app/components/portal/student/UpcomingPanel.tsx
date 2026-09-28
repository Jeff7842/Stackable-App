"use client";

// "Coming up today": the student's class timetable for today, with the running slot
// highlighted. Homework and assessments arrive in a later wave, so when there is
// nothing on the timetable the panel says so warmly instead of staying blank.

import type { CSSProperties } from "react";
import { Badge, Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { LessonSlot, TodaySchedule } from "@/lib/repositories/portal-types";
import { isBreakSlot, lessonPhase, lessonTitle, type LessonPhase } from "./clock";
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

function Row({ slot, phase, isNext, index }: { slot: LessonSlot; phase: LessonPhase; isNext: boolean; index: number }) {
  const now = phase === "now";
  const detail = [slot.teacherName, slot.room].filter(Boolean).join(" · ");
  return (
    <li
      aria-current={now ? "time" : undefined}
      style={stagger(index, 50)}
      className={cn(
        "flex animate-fade-up items-center gap-3 rounded-xl p-3 transition-[background-color,opacity] duration-300 ease-standard",
        now ? "bg-primary-tint" : "bg-recessed/60",
        phase === "done" && "opacity-60",
      )}
    >
      <div className="w-12 shrink-0 tabular-nums">
        <p className="text-sm font-semibold text-ink">{slot.startTime}</p>
        <p className="text-xs text-muted">{slot.endTime}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-display text-[0.95rem] font-semibold text-ink">
          {isBreakSlot(slot) ? <Icon icon="solar:cup-hot-linear" width={16} className="shrink-0 text-muted" /> : null}
          <span className="truncate">{lessonTitle(slot)}</span>
        </p>
        {detail ? <p className="mt-0.5 truncate text-xs text-ink-soft">{detail}</p> : null}
      </div>
      <div className="shrink-0">
        <StatusChip phase={phase} isNext={isNext} />
      </div>
    </li>
  );
}

export function UpcomingPanel({
  today,
  nowMin,
  className,
  style,
}: {
  today: TodaySchedule;
  /** Minutes since midnight in Nairobi, or null before the client clock is ready. */
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
      title="Coming up today"
      description={
        lessons.length > 0
          ? `${today.weekday ? `${today.weekday}, ` : ""}${lessons.length} ${lessons.length === 1 ? "slot" : "slots"} on your timetable`
          : today.weekday || undefined
      }
      className={className}
      style={style}
    >
      {lessons.length === 0 ? (
        <PanelEmpty icon="solar:sun-2-linear">
          Nothing on your timetable today. Homework and assessments will show up here when your teachers post them.
        </PanelEmpty>
      ) : (
        <ol className="space-y-2">
          {lessons.map((slot, i) => (
            <Row key={slot.id} slot={slot} phase={phases[i]} isNext={showNext && i === nextIndex} index={i} />
          ))}
        </ol>
      )}
    </Panel>
  );
}
