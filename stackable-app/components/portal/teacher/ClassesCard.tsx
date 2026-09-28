"use client";

// "My classes": pastel tiles (tone cycles through the palette tokens). Each tile
// links to the students list filtered to that class (/teach/students?class=<id>).

import type { CSSProperties } from "react";
import Link from "next/link";
import { AnimatedNumber, Badge, Button, Icon } from "@/components/ui";
import type { TeacherClassCard, TeacherPortalData } from "@/lib/repositories/portal-types";
import { cn } from "@/lib/cn";
import { Panel, PanelEmpty, stagger } from "./Panel";

// Static class strings so Tailwind can see them. Gold is used once (third tile).
const TILE_TONES = [
  { bg: "bg-primary-tint", ink: "text-primary-ink" },
  { bg: "bg-info-tint", ink: "text-info" },
  { bg: "bg-accent-tint", ink: "text-accent-ink" },
  { bg: "bg-success-tint", ink: "text-success" },
] as const;

function ClassTile({ cls, index }: { cls: TeacherClassCard; index: number }) {
  const tone = TILE_TONES[index % TILE_TONES.length];
  const total = cls.studentCount;
  const present = cls.presentToday;
  const share = present != null && total > 0 ? Math.min(100, Math.round((present / total) * 100)) : null;

  return (
    <li style={stagger(index, 50)} className="animate-fade-up">
      <Link
        href={`/teach/students?class=${encodeURIComponent(cls.id)}`}
        aria-label={`${cls.name}${cls.stream ? ` ${cls.stream}` : ""}, ${total} students. Open the student list.`}
        className={cn(
          "group block rounded-2xl p-4 outline-none transition-[translate,box-shadow] duration-300 ease-standard",
          "hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          tone.bg,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold text-ink">{cls.name}</p>
            {cls.stream ? <p className="mt-0.5 truncate text-xs text-ink-soft">{cls.stream}</p> : null}
          </div>
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-surface/70", tone.ink)}>
            <Icon icon="solar:arrow-right-linear" width={16} className="transition-transform duration-300 ease-standard group-hover:translate-x-0.5" />
          </span>
        </div>

        <p className="mt-4 flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-semibold tracking-tight text-ink">
            <AnimatedNumber value={total} />
          </span>
          <span className="text-xs text-ink-soft">{total === 1 ? "student" : "students"}</span>
        </p>

        <div className="mt-3">
          {share != null ? (
            <>
              <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-surface/70">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-standard"
                  style={{ width: `${share}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-ink-soft">
                <span className="font-semibold tabular-nums text-ink">{present}</span> present today
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-soft">Attendance not recorded today</p>
          )}
        </div>
      </Link>
    </li>
  );
}

export function ClassesCard({
  classes,
  subjects,
  className,
  style,
}: {
  classes: TeacherClassCard[];
  subjects: TeacherPortalData["subjects"];
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Panel
      title="My classes"
      description={classes.length > 0 ? "Open a class to see its students." : undefined}
      className={className}
      style={style}
      action={
        <Button as="a" href="/teach/classes" variant="ghost" size="sm" rightIcon="solar:arrow-right-linear">
          View all
        </Button>
      }
    >
      {classes.length === 0 ? (
        <PanelEmpty icon="solar:widget-2-linear">
          No classes assigned yet. Your school admin assigns classes from the workspace.
        </PanelEmpty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {classes.map((cls, i) => (
            <ClassTile key={cls.id} cls={cls} index={i} />
          ))}
        </ul>
      )}

      {subjects.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Subjects</span>
          {subjects.map((subject) => (
            <Badge key={subject.id} tone="info">
              {subject.subjectName}
            </Badge>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
