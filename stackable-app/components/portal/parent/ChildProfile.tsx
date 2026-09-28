"use client";

// =============================================================================
// Child profile (/family/children/[studentId]). Data: useChildOverview(id)
// (GET /api/parent/children/[studentId]) + the already-cached children list for the
// guardian relationship. The API scopes it: a child that is not linked to this parent
// answers 403 (bad id 400, removed student 404) and the page shows a "not your child"
// state instead of a Retry that could never work.
//
//   header card    avatar, name, admission no, class, status Badge, overall grade
//   pastel blocks  guardian relationship, class teacher, attendance, term summary
//   Tabs           Overview (progress + subjects + latest grades)
//                  Grades   (score trend or letter grid, grade mix, table)
//                  Attendance (ring + present/late/absent breakdown)
//
// Letters-only data: percentages, rings and trend lines appear only when real numbers
// exist; attendance with no rows says "Not recorded yet". The API returns attendance
// TOTALS only (no per-day rows), so the Attendance tab shows the breakdown of the recorded
// days rather than a day-by-day list.
// =============================================================================

import { Avatar, Badge, Button, EmptyState, Tabs } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { isChildAccessError, useChildOverview } from "@/hooks/useChildOverview";
import { useParentChildren } from "@/hooks/useParentChildren";
import type { AttendanceSummary, ChildCard, ChildOverview, GradeRow } from "@/lib/repositories/portal-types";
import { cn } from "@/lib/cn";
import { useEpochMinute } from "../student/clock";
import { GradeInsights } from "../student/GradeInsights";
import { gradeColumns, gradeColumnsWithScore } from "../student/gradeColumns";
import {
  attendanceRate,
  bandTone,
  buildSubjectCards,
  capitalize,
  errorMessage,
  formatDate,
  formatPct,
  fullName,
  gradeMix,
  gradeTone,
  pctBand,
  pluralize,
  share,
  sortNewestFirst,
  statusTone,
  summarizeGrades,
  type GradeSummary,
} from "../student/helpers";
import { LatestGrades } from "../student/LatestGrades";
import { AttendanceBlock, InfoBlock } from "../student/parts";
import { Panel, PanelEmpty, QueryError, stagger } from "../student/Panel";
import { ProgressPanel } from "../student/ProgressPanel";
import { SubjectsGrid } from "../student/SubjectsGrid";
import { ChildProfileSkeleton } from "./FamilySkeletons";
import { latestTerm, relationshipLabel } from "./helpers";

// ---- Not found / not yours -------------------------------------------------------
function NotYourChild() {
  return (
    <div className="animate-fade-up rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
      <EmptyState
        icon="solar:shield-warning-linear"
        title="We could not find this child"
        description="This profile is not linked to your account, or the link is no longer valid. Head back to your children and pick one from the list."
        action={
          <Button as="a" href="/family/children" variant="secondary" leftIcon="solar:arrow-left-linear">
            Back to my children
          </Button>
        }
      />
    </div>
  );
}

// ---- Header ----------------------------------------------------------------------
function ProfileHeader({ data, summary }: { data: ChildOverview; summary: GradeSummary }) {
  const s = data.student;
  const name = fullName(s.firstName, s.lastName);
  const born = formatDate(s.dateOfBirth);
  return (
    <section
      aria-label="Child profile"
      className="animate-fade-up rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <Avatar name={name} src={s.profilePicture} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl" title={name}>
            {name}
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {[s.className ?? "No class yet", s.admissionNo ? `Admission no ${s.admissionNo}` : ""].filter(Boolean).join(" · ")}
          </p>
          {born ? <p className="mt-0.5 text-xs text-muted">Born {born}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(s.status)} dot>
              {capitalize(s.status)}
            </Badge>
            {summary.overall ? (
              <Badge tone={gradeTone(summary.overall)}>Overall grade {summary.overall}</Badge>
            ) : (
              <Badge tone="neutral">No grades yet</Badge>
            )}
            {summary.averagePct != null ? (
              <Badge tone={bandTone(pctBand(summary.averagePct))}>{formatPct(summary.averagePct)} average</Badge>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function BlockValue({ main, sub }: { main: string; sub?: string }) {
  return (
    <>
      <p className="break-words">{main}</p>
      {sub ? <p className="mt-0.5 text-xs font-medium text-ink-soft">{sub}</p> : null}
    </>
  );
}

// ---- Tabs ------------------------------------------------------------------------
function OverviewTab({
  firstName,
  data,
  summary,
  newestFirst,
  epochMinute,
}: {
  firstName: string;
  data: ChildOverview;
  summary: GradeSummary;
  newestFirst: GradeRow[];
  epochMinute: number;
}) {
  const cards = buildSubjectCards(data.subjects, data.grades);
  return (
    <div className="flex flex-col gap-6">
      <ProgressPanel
        summary={summary}
        mix={gradeMix(data.grades)}
        attendance={data.attendance}
        description={`Where ${firstName} stands right now.`}
      />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <SubjectsGrid
          cards={cards}
          title="Subjects"
          description={`${firstName}'s latest letter in each subject.`}
          linkFor={() => null}
          allHref={null}
          emptyText="No subjects yet. They appear here once the school enrols this child in them."
        />
        <LatestGrades
          grades={newestFirst}
          epochMinute={epochMinute}
          viewAllHref={null}
          description={`The newest reports for ${firstName}.`}
          emptyText="No grades yet. Reports appear here as soon as teachers record them."
        />
      </div>
    </div>
  );
}

function GradesTab({ firstName, grades }: { firstName: string; grades: GradeRow[] }) {
  if (grades.length === 0) {
    return (
      <Panel title="Grades">
        <PanelEmpty icon="solar:chart-square-linear">
          No grades recorded for {firstName} yet. Reports appear here as soon as teachers record them.
        </PanelEmpty>
      </Panel>
    );
  }
  const hasScores = grades.some((g) => g.normalizedPct != null || g.rawScore != null);
  return (
    <div className="flex flex-col gap-6">
      <GradeInsights rows={grades} seriesName={`${firstName}'s average`} showSubjectBars />
      <DataTable<GradeRow>
        columns={hasScores ? gradeColumnsWithScore : gradeColumns}
        data={grades}
        searchable={grades.length > 10}
        searchPlaceholder="Search subject, term or grade"
        caption={`${firstName}'s grade reports`}
        pageSize={10}
      />
    </div>
  );
}

const BREAKDOWN: Array<{ key: "present" | "late" | "absent"; label: string; bar: string }> = [
  { key: "present", label: "Present", bar: "bg-success" },
  { key: "late", label: "Late", bar: "bg-warning" },
  { key: "absent", label: "Absent", bar: "bg-danger" },
];

function AttendanceTab({ attendance }: { attendance: AttendanceSummary }) {
  const rate = attendanceRate(attendance);
  if (rate === null) {
    return (
      <Panel title="Attendance">
        <PanelEmpty icon="solar:clipboard-check-linear">No attendance recorded yet for this child.</PanelEmpty>
      </Panel>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <Panel title="Attendance summary" description={`${pluralize(attendance.total, "day")} recorded`}>
        <AttendanceBlock attendance={attendance} layout="side" ringHeight={170} />
      </Panel>
      <Panel title="Breakdown" description="Share of the recorded days.">
        <ul className="space-y-2">
          {BREAKDOWN.map((row, i) => {
            const count = attendance[row.key];
            const pct = share(count, attendance.total);
            return (
              <li key={row.key} style={stagger(i, 50)} className="animate-fade-up rounded-xl bg-recessed/60 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{row.label}</span>
                  <span className="tabular-nums text-ink-soft">
                    {pluralize(count, "day")} · {pct}%
                  </span>
                </div>
                <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-field">
                  <div className={cn("h-full rounded-full", row.bar)} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

// ---- Body ------------------------------------------------------------------------
function ProfileBody({ data, link }: { data: ChildOverview; link: ChildCard | undefined }) {
  const epochMinute = useEpochMinute();
  const s = data.student;
  const firstName = s.firstName ?? s.lastName;
  const newestFirst = sortNewestFirst(data.grades);
  const summary = summarizeGrades(data.grades, s.averageGrade);
  const rate = attendanceRate(data.attendance);
  const term = latestTerm(data.grades);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button as="a" href="/family/children" variant="ghost" size="sm" leftIcon="solar:arrow-left-linear">
          All children
        </Button>
      </div>

      <ProfileHeader data={data} summary={summary} />

      <section aria-label="Quick facts" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InfoBlock
          index={0}
          icon="solar:user-hands-linear"
          label="Your role"
          tint="accent"
          value={
            <BlockValue
              main={link ? relationshipLabel(link.relationship) : "Guardian"}
              sub={link?.isPrimary ? "Primary contact" : undefined}
            />
          }
        />
        <InfoBlock
          index={1}
          icon="solar:square-academic-cap-linear"
          label="Class teacher"
          tint="primary"
          value={<BlockValue main={s.classTeacherName ?? "Not assigned yet"} sub={s.className ?? undefined} />}
        />
        <InfoBlock
          index={2}
          icon="solar:clipboard-check-linear"
          label="Attendance"
          tint="success"
          value={
            rate === null ? (
              <BlockValue main="Not recorded yet" />
            ) : (
              <BlockValue
                main={`${rate}% present`}
                sub={`${data.attendance.present + data.attendance.late} of ${pluralize(data.attendance.total, "day")}`}
              />
            )
          }
        />
        <InfoBlock
          index={3}
          icon="solar:document-text-linear"
          label="Term summary"
          tint="info"
          value={
            term ? (
              <BlockValue main={term.term} sub={`${pluralize(term.subjectCount, "subject")} graded`} />
            ) : (
              <BlockValue main="No grades yet" />
            )
          }
        />
      </section>

      <Tabs
        aria-label="Child profile sections"
        defaultValue="overview"
        items={[
          {
            id: "overview",
            label: "Overview",
            icon: "solar:widget-2-linear",
            content: (
              <OverviewTab firstName={firstName} data={data} summary={summary} newestFirst={newestFirst} epochMinute={epochMinute} />
            ),
          },
          {
            id: "grades",
            label: "Grades",
            icon: "solar:chart-square-linear",
            count: data.grades.length,
            content: <GradesTab firstName={firstName} grades={newestFirst} />,
          },
          {
            id: "attendance",
            label: "Attendance",
            icon: "solar:clipboard-check-linear",
            content: <AttendanceTab attendance={data.attendance} />,
          },
        ]}
      />
    </div>
  );
}

export default function ChildProfile({ studentId }: { studentId: string | undefined }) {
  const query = useChildOverview(studentId);
  const children = useParentChildren();

  if (!studentId) return <NotYourChild />;

  // A failed background refresh keeps showing the last good data (quiet); only a
  // failure with nothing to show becomes an error state.
  if (query.isError && !query.data) {
    if (isChildAccessError(query.error)) return <NotYourChild />;
    return (
      <QueryError
        title="We could not load this profile"
        message={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (!query.data) return <ChildProfileSkeleton />;

  const link = children.data?.find((c) => c.studentId === studentId);
  return <ProfileBody data={query.data} link={link} />;
}
