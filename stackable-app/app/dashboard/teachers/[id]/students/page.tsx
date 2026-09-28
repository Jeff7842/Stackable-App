"use client";

/**
 * Teacher attendance (/dashboard/teachers/[id]/students) - despite the route
 * name (kept so existing links keep working), this page has always shown the
 * teacher's own clock-in history, not the students they teach - that view
 * lives on the profile page (/dashboard/teachers/[id]). Labels in this
 * redesign say "Attendance" rather than "Students / Pupils" to avoid the
 * confusion the old labels caused.
 *
 * Converted from a direct Supabase read (teachers + attendance) to
 * useTeacherAttendance(id) (hooks/useTeachers.ts, Prisma/Neon backed).
 */
import { useParams } from "next/navigation";
import { Avatar, Badge, Button, DataTable, EmptyState, Skeleton } from "@/components/ui";
import { useTeacherAttendance, type TeacherAttendanceRecord } from "@/hooks/useTeachers";
import { TeacherStatusBadge } from "@/components/admin/teachers/StatusBadge";
import { formatDateTime, formatTime, percentage } from "@/components/admin/teachers/utils";

function statusTone(status: string) {
  switch (status) {
    case "present":
      return "success" as const;
    case "late":
      return "warning" as const;
    case "absent":
      return "error" as const;
    default:
      return "neutral" as const;
  }
}

export default function TeacherAttendancePage() {
  const params = useParams();
  const id = params?.id as string;
  const { data, isLoading, isError, error, refetch } = useTeacherAttendance(id);

  if (isLoading) {
    return (
      <div className="space-y-5 pb-6">
        <Skeleton className="h-28" rounded="2xl" />
        <Skeleton className="h-96" rounded="2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
        <EmptyState
          icon="solar:danger-triangle-linear"
          title="Attendance could not be loaded"
          description={error instanceof Error ? error.message : "The requested teacher record could not be loaded."}
          action={
            <Button variant="secondary" leftIcon="solar:refresh-linear" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const { teacher, summary, records, truncated } = data;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <div className="flex items-center gap-4">
          <Avatar name={teacher.name} src={teacher.profile_photo} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold text-ink">{teacher.name}</h2>
            <p className="truncate text-sm text-ink-soft">{teacher.email || teacher.admission_number}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <TeacherStatusBadge status={teacher.status} />
              {teacher.class_teacher ? <Badge tone="info">Class teacher</Badge> : null}
              {teacher.subject_name ? <Badge tone="neutral">{teacher.subject_name}</Badge> : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button as="a" href={`/dashboard/teachers/${id}`} variant="ghost" leftIcon="solar:arrow-left-linear">
            Back to teacher
          </Button>
          <Button as="a" href={`/dashboard/teachers/${id}/timetable`} variant="secondary" leftIcon="solar:calendar-linear">
            Timetable
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost">
          <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Attendance rate</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{percentage(teacher.attendance_percentage)}%</p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost">
          <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Present</p>
          <p className="mt-2 text-2xl font-semibold text-success">{summary.present}</p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost">
          <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Late</p>
          <p className="mt-2 text-2xl font-semibold text-warning">{summary.late}</p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost">
          <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Absent</p>
          <p className="mt-2 text-2xl font-semibold text-danger">{summary.absent}</p>
        </div>
      </div>

      <section className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
        <div className="p-5 pb-0">
          <h3 className="font-display text-base font-semibold text-ink">Attendance records</h3>
          <p className="mt-1 text-sm text-ink-soft">
            {truncated ? `Showing the most recent ${records.length} of ${summary.total} records.` : `${summary.total} records in total.`}
          </p>
        </div>
        <DataTable<TeacherAttendanceRecord>
          caption="Attendance records"
          searchable={false}
          getRowId={(r) => r.id}
          columns={[
            { accessorKey: "reference_code", header: "Reference" },
            { id: "date", header: "Date", accessorFn: (r) => r.clock_in, cell: (c) => formatDateTime(c.getValue<string>()) },
            { id: "in", header: "Clock in", accessorFn: (r) => r.clock_in, cell: (c) => formatTime(c.getValue<string>()) },
            { id: "out", header: "Clock out", accessorFn: (r) => r.clock_out, cell: (c) => formatTime(c.getValue<string | null>() ?? null) },
            {
              id: "status",
              header: "Status",
              accessorKey: "status",
              cell: (c) => (
                <Badge tone={statusTone(c.getValue<string>())} dot>
                  {c.getValue<string>()}
                </Badge>
              ),
            },
            { id: "remarks", header: "Remarks", accessorFn: (r) => r.remarks ?? "", cell: (c) => c.getValue<string>() || "—" },
          ]}
          data={records}
          emptyState={
            <EmptyState icon="solar:calendar-mark-linear" title="No attendance records" description="Clock-in records for this teacher will appear here." />
          }
        />
      </section>
    </div>
  );
}
