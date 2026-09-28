"use client";

// =============================================================================
// Teacher students page body (/teach/students).
//
// - DataTable in CLIENT mode (the endpoint returns the whole assigned list):
//   search pill, class filter, status filter, sortable columns, paging.
// - Row click opens the StudentDrawer.
// - DEEP-LINK CONTRACT: the drawer state lives in the URL as `?student=<id>`.
//   Opening/closing uses history.replaceState (Next syncs useSearchParams with it),
//   so it is instant and needs no server round trip. Opening
//   /teach/students?student=<id> directly (e.g. from the teacher home) shows the
//   list with that student's drawer already open. An extra optional
//   `?class=<classId>` pre-selects the class filter (used by the home class tiles).
// =============================================================================

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatedNumber, Button, EmptyState, Icon, Select } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { useTeacherStudents } from "@/hooks/useTeacherStudents";
import type { TeacherStudent } from "@/lib/repositories/portal-types";
import { cn } from "@/lib/cn";
import { capitalize, errorMessage } from "./helpers";
import { QueryError, stagger } from "./Panel";
import { StudentDrawer } from "./StudentDrawer";
import { studentColumns } from "./studentColumns";

const ALL = "all";
const NO_CLASS = "none";

// ---- Summary tiles -------------------------------------------------------------
function SummaryTile({
  label,
  icon,
  bg,
  ink,
  value,
  suffix,
  decimals = 0,
  index,
}: {
  label: string;
  icon: string;
  bg: string;
  ink: string;
  value: number | null;
  suffix?: string;
  decimals?: number;
  index: number;
}) {
  return (
    <div
      style={stagger(index, 50)}
      className={cn(
        "flex animate-fade-up items-center gap-3 rounded-2xl p-4 transition-[translate,box-shadow] duration-300 ease-standard",
        "hover:-translate-y-0.5 hover:shadow-lift",
        bg,
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-surface/70", ink)}>
        <Icon icon={icon} width={20} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink-soft">{label}</p>
        <p className="font-display text-2xl font-semibold tracking-tight text-ink">
          {value == null ? "-" : <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />}
        </p>
      </div>
    </div>
  );
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

export default function StudentsView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const studentParam = searchParams.get("student");

  const query = useTeacherStudents();
  const [classFilter, setClassFilter] = useState(() => searchParams.get("class") ?? ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  // Keep the last opened id after close so the drawer's exit animation keeps its content.
  const [shownId, setShownId] = useState<string | null>(studentParam);
  if (studentParam && studentParam !== shownId) setShownId(studentParam);

  const setStudentParam = (id: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (id) next.set("student", id);
    else next.delete("student");
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  const students = query.data?.students ?? [];

  if (query.isError && !query.data) {
    return (
      <QueryError
        title="We could not load your students"
        message={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  // Class filter options: one per classId (label = class name); students without a class get "No class".
  const classMap = new Map<string, string>();
  let hasUnassigned = false;
  for (const s of students) {
    if (s.classId) classMap.set(s.classId, s.className ?? "Unnamed class");
    else hasUnassigned = true;
  }
  const classOptions = Array.from(classMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const statusOptions = Array.from(new Set(students.map((s) => s.status))).sort();

  const filtered = students.filter((s) => {
    const classOk = classFilter === ALL || (classFilter === NO_CLASS ? !s.classId : s.classId === classFilter);
    const statusOk = statusFilter === ALL || s.status === statusFilter;
    return classOk && statusOk;
  });

  const avgScore = mean(students.flatMap((s) => (s.averagePct == null ? [] : [s.averagePct])));
  const avgAttendance = mean(students.flatMap((s) => (s.attendanceRate == null ? [] : [s.attendanceRate])));
  const needAttention = students.filter((s) => s.averagePct != null && s.averagePct < 50).length;

  const selectedRow: TeacherStudent | undefined = students.find((s) => s.id === shownId);
  const filtersActive = classFilter !== ALL || statusFilter !== ALL;
  const loading = query.isPending;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft" aria-live="polite">
          {loading
            ? "Loading your students"
            : `${students.length} ${students.length === 1 ? "student" : "students"} assigned to you`}
        </p>
        <Button
          variant="ghost"
          size="sm"
          leftIcon="solar:refresh-linear"
          loading={query.isFetching && !loading}
          onClick={() => void query.refetch()}
          aria-label="Refresh students"
        >
          Refresh
        </Button>
      </div>

      {!loading && students.length > 0 ? (
        <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryTile index={0} label="Assigned students" icon="solar:users-group-rounded-linear" bg="bg-primary-tint" ink="text-primary-ink" value={students.length} />
          <SummaryTile index={1} label="Average score" icon="solar:chart-square-linear" bg="bg-info-tint" ink="text-info" value={avgScore} suffix="%" decimals={1} />
          <SummaryTile index={2} label="Attendance" icon="solar:clipboard-check-linear" bg="bg-success-tint" ink="text-success" value={avgAttendance} suffix="%" decimals={1} />
          <SummaryTile index={3} label="Below 50%" icon="solar:danger-triangle-linear" bg="bg-warning-tint" ink="text-warning" value={needAttention} />
        </section>
      ) : null}

      <DataTable<TeacherStudent>
        columns={studentColumns}
        data={filtered}
        loading={loading}
        getRowId={(s) => s.id}
        onRowClick={(s) => setStudentParam(s.id)}
        searchPlaceholder="Search by name or admission number"
        caption="Students assigned to you"
        pageSize={10}
        filters={
          <>
            <Select
              size="sm"
              pill
              aria-label="Filter by class"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-40"
            >
              <option value={ALL}>All classes</option>
              {classOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
              {hasUnassigned ? <option value={NO_CLASS}>No class</option> : null}
            </Select>
            <Select
              size="sm"
              pill
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-40"
            >
              <option value={ALL}>All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {capitalize(status)}
                </option>
              ))}
            </Select>
          </>
        }
        emptyState={
          students.length === 0 ? (
            <EmptyState
              icon="solar:users-group-rounded-linear"
              title="No students assigned yet"
              description="Students appear here once your school assigns you to a class or subject."
            />
          ) : (
            <EmptyState
              icon="solar:magnifer-linear"
              title="No students match"
              description="Try a different search or clear the filters."
              action={
                filtersActive ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setClassFilter(ALL);
                      setStatusFilter(ALL);
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )
        }
      />

      <StudentDrawer
        open={Boolean(studentParam)}
        studentId={shownId}
        fallback={selectedRow}
        onClose={() => setStudentParam(null)}
      />
    </div>
  );
}
