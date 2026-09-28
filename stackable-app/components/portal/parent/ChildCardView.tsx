"use client";

// One child, two presentations:
//   ChildCardFull  the rich card on the family home: identity, attendance ring (or a
//                  plain "not recorded yet" note), latest letter, subjects, View button.
//   ChildRow       the compact row on /family/children: identity, chips, View button.
// Both link to /family/children/<studentId>. Letters lead; an average score, an overall
// grade or an attendance rate is shown only when the school recorded one.
// The big card does NOT lift on hover (only small tiles do); its button does.

import type { ReactNode } from "react";
import { Avatar, Badge, Button, Icon } from "@/components/ui";
import { RingChart, useChartTheme } from "@/components/ui/Chart";
import type { ChildCard } from "@/lib/repositories/portal-types";
import { attendanceTone, formatPct, pluralize } from "../student/helpers";
import { GradeBadge } from "../student/parts";
import { stagger } from "../student/Panel";
import { childName, relationshipLabel } from "./helpers";

const profileHref = (child: ChildCard) => `/family/children/${child.studentId}`;

function MiniStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-recessed/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <div className="mt-1 text-sm font-semibold text-ink">{children}</div>
    </div>
  );
}

function AttendanceRing({ rate }: { rate: number | null }) {
  const theme = useChartTheme();
  if (rate === null) {
    return (
      <div className="grid min-h-32 place-items-center gap-1.5 text-center text-sm text-ink-soft">
        <Icon icon="solar:clipboard-check-linear" width={22} className="text-muted" />
        <p>No attendance recorded yet</p>
      </div>
    );
  }
  const tone = attendanceTone(rate);
  const color = tone === "success" ? theme.success : tone === "warning" ? theme.warning : theme.danger;
  return (
    <div className="mx-auto w-full max-w-[9rem]">
      <RingChart value={rate} label="Present" color={color} height={128} />
    </div>
  );
}

export function ChildCardFull({ child, index = 0 }: { child: ChildCard; index?: number }) {
  const name = childName(child);
  const latest = child.latestGrade;
  return (
    <article
      aria-label={name}
      style={stagger(index)}
      className="flex animate-fade-up flex-col gap-4 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost"
    >
      <header className="flex items-start gap-3.5">
        <Avatar name={name} src={child.profilePicture} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-semibold tracking-tight text-ink" title={name}>
            {name}
          </h3>
          <p className="truncate text-sm text-ink-soft">
            {[child.className ?? "No class yet", child.admissionNo].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2">
            <Badge tone="info" size="sm">
              {relationshipLabel(child.relationship)}
            </Badge>
          </div>
        </div>
      </header>

      <div className="rounded-xl bg-recessed/60 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Attendance</p>
        <AttendanceRing rate={child.attendanceRate} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <MiniStat label="Latest grade">
          {latest ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <GradeBadge grade={latest.grade} size="md" />
              <span className="min-w-0 truncate text-xs font-medium text-ink-soft" title={`${latest.subject} · ${latest.term}`}>
                {latest.subject}
              </span>
            </span>
          ) : (
            <span className="font-medium text-muted">No grades yet</span>
          )}
        </MiniStat>
        <MiniStat label="Subjects">
          <span className="tabular-nums">{child.subjectCount}</span>
        </MiniStat>
        {child.averageGrade ? (
          <MiniStat label="Overall grade">
            <GradeBadge grade={child.averageGrade} size="md" />
          </MiniStat>
        ) : null}
        {child.averagePct != null ? (
          <MiniStat label="Average score">
            <span className="tabular-nums">{formatPct(child.averagePct)}</span>
          </MiniStat>
        ) : null}
      </div>

      <Button as="a" href={profileHref(child)} variant="secondary" fullWidth rightIcon="solar:arrow-right-linear" className="mt-auto">
        View profile
      </Button>
    </article>
  );
}

export function ChildRow({ child, index = 0 }: { child: ChildCard; index?: number }) {
  const name = childName(child);
  const latest = child.latestGrade;
  return (
    <article
      aria-label={name}
      style={stagger(index, 50)}
      className="flex animate-fade-up flex-col gap-3 rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 items-center gap-3.5 sm:w-72 sm:shrink-0">
        <Avatar name={name} src={child.profilePicture} size="lg" />
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold tracking-tight text-ink" title={name}>
            {name}
          </h3>
          <p className="truncate text-sm text-ink-soft">
            {[child.className ?? "No class yet", child.admissionNo].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <li>
          <Badge tone="info" size="sm">
            {relationshipLabel(child.relationship)}
          </Badge>
        </li>
        <li>
          {latest ? (
            <Badge tone="neutral" size="sm">
              Latest <span className="ml-1 text-ink">{latest.grade}</span>
              <span className="ml-1 max-w-32 truncate font-medium">{latest.subject}</span>
            </Badge>
          ) : (
            <Badge tone="neutral" size="sm">
              No grades yet
            </Badge>
          )}
        </li>
        <li>
          {child.attendanceRate != null ? (
            <Badge
              tone={
                attendanceTone(child.attendanceRate) === "success"
                  ? "success"
                  : attendanceTone(child.attendanceRate) === "warning"
                    ? "warning"
                    : "error"
              }
              size="sm"
              icon="solar:clipboard-check-linear"
            >
              <span className="tabular-nums">{formatPct(child.attendanceRate)}</span> present
            </Badge>
          ) : (
            <Badge tone="neutral" size="sm" icon="solar:clipboard-check-linear">
              No attendance yet
            </Badge>
          )}
        </li>
        <li>
          <Badge tone="neutral" size="sm" icon="solar:book-2-linear">
            {pluralize(child.subjectCount, "subject")}
          </Badge>
        </li>
      </ul>

      <Button as="a" href={profileHref(child)} variant="secondary" size="sm" rightIcon="solar:arrow-right-linear" className="sm:shrink-0">
        View profile
      </Button>
    </article>
  );
}
