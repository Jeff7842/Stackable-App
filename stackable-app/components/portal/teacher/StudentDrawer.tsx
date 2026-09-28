"use client";

// =============================================================================
// Student profile drawer (right slide-over), modelled on the "User details"
// reference: identity header, pastel info blocks, attendance ring, grades table.
//
// The profile is fetched with useTeacherStudentProfile(id, open) ONLY while the
// drawer is open. Loading = skeleton, failure = message + Retry (a 404 means the
// student is not assigned to this teacher; the server message is shown as is).
// While loading, the list row (if known) supplies the name so the header never
// flashes empty.
// =============================================================================

import type { ReactNode } from "react";
import { AnimatedNumber, Avatar, Badge, Button, Drawer, Icon, Skeleton } from "@/components/ui";
import { RingChart, useChartTheme } from "@/components/ui/Chart";
import { useTeacherStudentProfile } from "@/hooks/useTeacherStudents";
import type { GradeRow, TeacherStudent, TeacherStudentProfile } from "@/lib/repositories/portal-types";
import { cn } from "@/lib/cn";
import {
  capitalize,
  errorMessage,
  formatDob,
  formatPct,
  fullName,
  gradeTone,
  scoreBar,
  statusTone,
} from "./helpers";
import { Panel, PanelEmpty, QueryError, stagger } from "./Panel";

// ---- Pastel info block ---------------------------------------------------------
function InfoBlock({
  icon,
  label,
  value,
  bg,
  ink,
  index,
}: {
  icon: string;
  label: string;
  value: string;
  bg: string;
  ink: string;
  index: number;
}) {
  return (
    <div style={stagger(index, 50)} className={cn("animate-fade-up rounded-2xl p-4", bg)}>
      <span className={cn("grid size-9 place-items-center rounded-full bg-surface/70", ink)}>
        <Icon icon={icon} width={18} />
      </span>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold text-ink" title={value}>
        {value}
      </p>
    </div>
  );
}

// ---- Attendance --------------------------------------------------------------
function CountTile({
  icon,
  label,
  value,
  bg,
  ink,
}: {
  icon: string;
  label: string;
  value: number;
  bg: string;
  ink: string;
}) {
  return (
    <div className={cn("rounded-xl px-3 py-2.5", bg)}>
      <p className={cn("flex items-center gap-1.5 text-xs font-semibold", ink)}>
        <Icon icon={icon} width={14} />
        {label}
      </p>
      <p className="mt-0.5 font-display text-xl font-semibold text-ink">
        <AnimatedNumber value={value} />
      </p>
    </div>
  );
}

function AttendanceSection({ attendance }: { attendance: TeacherStudentProfile["attendance"] }) {
  const theme = useChartTheme();
  const hasRecords = attendance.total > 0;
  // Ring colour follows the same 90 / 75 thresholds as the table dot (token-derived colours).
  const ringColor = attendance.rate >= 90 ? theme.success : attendance.rate >= 75 ? theme.warning : theme.danger;

  return (
    <Panel
      title="Attendance"
      description={hasRecords ? `${attendance.total} ${attendance.total === 1 ? "day" : "days"} recorded` : undefined}
      style={stagger(2)}
    >
      {hasRecords ? (
        <div className="grid items-center gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <RingChart value={attendance.rate} label="Present" color={ringColor} height={160} />
          <div className="grid grid-cols-3 gap-2.5">
            <CountTile icon="solar:user-check-rounded-linear" label="Present" value={attendance.present} bg="bg-success-tint" ink="text-success" />
            <CountTile icon="solar:clock-square-linear" label="Late" value={attendance.late} bg="bg-warning-tint" ink="text-warning" />
            <CountTile icon="solar:user-cross-rounded-linear" label="Absent" value={attendance.absent} bg="bg-danger-tint" ink="text-danger" />
          </div>
        </div>
      ) : (
        <PanelEmpty icon="solar:clipboard-check-linear">No attendance recorded for this student yet.</PanelEmpty>
      )}
    </Panel>
  );
}

// ---- Grades table ------------------------------------------------------------
function sortGrades(grades: GradeRow[]): GradeRow[] {
  // Newest first; rows without a date keep their relative order at the end.
  return [...grades].sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0));
}

function GradesSection({ grades }: { grades: GradeRow[] }) {
  const rows = sortGrades(grades);
  return (
    <Panel
      title="Grades"
      description={rows.length > 0 ? "By subject and term, newest first." : undefined}
      style={stagger(3)}
    >
      {rows.length === 0 ? (
        <PanelEmpty icon="solar:chart-square-linear">No grades recorded for this student yet.</PanelEmpty>
      ) : (
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">Grades by subject and term</caption>
            <thead>
              <tr>
                {["Subject", "Term", "Grade", "Score"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="bg-recessed px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap text-muted first:rounded-l-xl last:rounded-r-xl"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((g, i) => (
                <tr key={`${g.subject}-${g.term}-${i}`} className="odd:bg-surface even:bg-recessed/50">
                  <td className="px-3 py-2.5 font-semibold text-ink">{g.subject}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">{g.term}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={gradeTone(g.normalizedPct)} size="sm">
                      {g.grade}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-10 font-medium tabular-nums text-ink-soft">{formatPct(g.normalizedPct)}</span>
                      {g.normalizedPct != null ? (
                        <div aria-hidden="true" className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-field sm:block">
                          <div
                            className={cn("h-full rounded-full", scoreBar(g.normalizedPct))}
                            style={{ width: `${Math.max(0, Math.min(100, g.normalizedPct))}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ---- Header + body ---------------------------------------------------------------
function ProfileHero({
  name,
  src,
  status,
  meta,
  average,
}: {
  name: string;
  src?: string | null;
  status?: string;
  meta?: string;
  average?: ReactNode;
}) {
  return (
    <section aria-label="Student" className="animate-fade-up rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
      <div className="flex items-center gap-4">
        <Avatar name={name} src={src} size="xl" />
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl font-semibold tracking-tight text-ink">{name}</h3>
          {meta ? <p className="mt-0.5 truncate text-sm text-ink-soft">{meta}</p> : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {status ? (
              <Badge tone={statusTone(status)} dot>
                {capitalize(status)}
              </Badge>
            ) : null}
            {average}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileBody({ profile }: { profile: TeacherStudentProfile }) {
  const s = profile.student;
  const name = fullName(s.firstName, s.lastName);
  return (
    <div className="flex flex-col gap-5">
      <ProfileHero
        name={name}
        src={s.profilePicture}
        status={s.status}
        meta={[s.className, s.admissionNo].filter(Boolean).join(" · ")}
        average={
          s.averagePct != null ? (
            <Badge tone={gradeTone(s.averagePct)}>
              {s.averageGrade ? `${s.averageGrade} · ` : ""}
              {formatPct(s.averagePct)} average
            </Badge>
          ) : (
            <Badge tone="neutral">No grades yet</Badge>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <InfoBlock index={0} icon="solar:widget-2-linear" label="Class" value={s.className ?? "Not assigned"} bg="bg-primary-tint" ink="text-primary-ink" />
        <InfoBlock index={1} icon="solar:hashtag-linear" label="Admission no" value={s.admissionNo || "-"} bg="bg-info-tint" ink="text-info" />
        <InfoBlock index={2} icon="solar:calendar-linear" label="Date of birth" value={formatDob(s.dateOfBirth)} bg="bg-accent-tint" ink="text-accent-ink" />
        <InfoBlock index={3} icon="solar:letter-linear" label="Email" value={s.email ?? "-"} bg="bg-success-tint" ink="text-success" />
      </div>

      <AttendanceSection attendance={profile.attendance} />
      <GradesSection grades={profile.grades} />
    </div>
  );
}

function ProfileSkeleton({ fallback }: { fallback?: TeacherStudent }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading student profile" className="flex flex-col gap-5">
      {fallback ? (
        <ProfileHero
          name={fullName(fallback.firstName, fallback.lastName)}
          src={fallback.profilePicture}
          status={fallback.status}
          meta={[fallback.className, fallback.admissionNo].filter(Boolean).join(" · ")}
        />
      ) : (
        <div className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
          <div className="flex items-center gap-4">
            <Skeleton rounded="full" className="size-20" />
            <div className="flex-1">
              <Skeleton className="h-6 w-48 max-w-full" />
              <Skeleton className="mt-2 h-4 w-32" />
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} rounded="2xl" className="h-28" />
        ))}
      </div>
      <Skeleton rounded="2xl" className="h-52" />
      <Skeleton rounded="2xl" className="h-56" />
      <span className="sr-only">Loading student profile</span>
    </div>
  );
}

export function StudentDrawer({
  open,
  studentId,
  fallback,
  onClose,
}: {
  open: boolean;
  /** Kept set for a moment after `open` turns false so the exit animation keeps its content. */
  studentId: string | null;
  /** The list row for this student, if the list has loaded. */
  fallback?: TeacherStudent;
  onClose: () => void;
}) {
  const query = useTeacherStudentProfile(studentId, open);

  let content: ReactNode;
  if (query.data) {
    content = <ProfileBody profile={query.data} />;
  } else if (query.isError) {
    content = (
      <QueryError
        title="We could not open this profile"
        message={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        className="py-10"
      />
    );
  } else {
    content = <ProfileSkeleton fallback={fallback} />;
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Student profile"
      subtitle="Grades and attendance for a student you teach."
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {content}
    </Drawer>
  );
}
