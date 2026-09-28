"use client";

/**
 * Teacher profile (/dashboard/teachers/[id]) - identity, workload stats and
 * every student linked to the classes this teacher teaches, with their
 * current performance.
 *
 * This page already used a client-side `fetch` to GET /api/teachers/[id]
 * (never imported Supabase directly, so it was not one of the six pages this
 * pass had to migrate) but was still on the old hex/lucide-react design - it
 * is redesigned here onto the shared design system and useTeacher(id)
 * (hooks/useTeachers.ts, TanStack Query) to match the rest of the workspace.
 */
import { useParams } from "next/navigation";
import { Avatar, Badge, Button, DataTable, EmptyState, Icon, Skeleton } from "@/components/ui";
import { useTeacher, type TeacherPupil } from "@/hooks/useTeachers";
import { TeacherStatusBadge } from "@/components/admin/teachers/StatusBadge";
import { percentage } from "@/components/admin/teachers/utils";
import { STATUS_LABEL as STUDENT_STATUS_LABEL, STATUS_TONE as STUDENT_STATUS_TONE } from "@/components/admin/students/utils";

export default function TeacherProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  const { data, isLoading, isError, error, refetch } = useTeacher(id);

  if (isLoading) {
    return (
      <div className="space-y-5 pb-6">
        <Skeleton className="h-10 w-40" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
          <Skeleton className="h-80" rounded="2xl" />
          <Skeleton className="h-96" rounded="2xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
        <EmptyState
          icon="solar:danger-triangle-linear"
          title="Teacher not found"
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

  const { teacher, students } = data;
  const scores = students.map((s) => s.avg_score).filter((s): s is number => s != null);
  const averagePerformance = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <Button as="a" href="/dashboard/teachers" variant="ghost" size="sm" leftIcon="solar:arrow-left-linear">
          Back to teachers
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button as="a" href={`/dashboard/teachers/${id}/students`} variant="ghost" leftIcon="solar:clock-circle-linear">
            Attendance
          </Button>
          <Button as="a" href={`/dashboard/teachers/${id}/timetable`} variant="secondary" leftIcon="solar:calendar-linear">
            Timetable
          </Button>
          <Button as="a" href={`/dashboard/teachers/${id}/edit`} leftIcon="solar:pen-2-linear">
            Edit teacher
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_1fr]">
        <div className="rounded-2xl bg-surface p-6 shadow-soft ring-1 ring-ghost">
          <div className="flex flex-col items-center text-center">
            <Avatar name={teacher.name} src={teacher.profile_photo} size="xl" />
            <h2 className="mt-4 font-display text-xl font-semibold text-ink">{teacher.name}</h2>
            <div className="mt-2">
              <TeacherStatusBadge status={teacher.status} />
            </div>

            <div className="mt-5 w-full space-y-2.5 text-left">
              {[
                { icon: "solar:card-2-linear" as const, label: "Admission", value: teacher.admission_number },
                { icon: "solar:letter-linear" as const, label: "Email", value: teacher.email || "Not provided" },
                { icon: "solar:phone-linear" as const, label: "Phone", value: teacher.phone || "Not provided" },
                { icon: "solar:buildings-2-linear" as const, label: "School", value: teacher.school_name || "Not set" },
                {
                  icon: "solar:square-academic-cap-linear" as const,
                  label: "Classes",
                  value: teacher.classes.length ? teacher.classes.map((c) => c.label).join(", ") : "No class assigned",
                },
                {
                  icon: "solar:book-2-linear" as const,
                  label: "Subjects",
                  value: teacher.subjects.length ? teacher.subjects.map((s) => s.subject_name).join(", ") : "No subject assigned",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 rounded-xl bg-recessed p-3">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary-ink">
                    <Icon icon={item.icon} width={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{item.label}</p>
                    <p className="mt-0.5 text-sm font-medium break-words text-ink">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <div className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost">
              <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Students taught</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{teacher.students_count}</p>
            </div>
            <div className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost">
              <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Average performance</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{averagePerformance != null ? averagePerformance.toFixed(2) : "—"}</p>
            </div>
            <div className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost">
              <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Attendance</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{percentage(teacher.attendance_percentage)}%</p>
            </div>
            <div className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost">
              <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Class teacher</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{teacher.class_teacher ? "Yes" : "No"}</p>
            </div>
          </div>

          <section className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
            <div className="p-5 pb-0">
              <h3 className="font-display text-base font-semibold text-ink">Students taught by this teacher</h3>
              <p className="mt-1 text-sm text-ink-soft">Performance uses each student&apos;s average graded score.</p>
            </div>
            <DataTable<TeacherPupil>
              caption="Students taught"
              searchPlaceholder="Search student or admission number"
              pageSizeOptions={[10, 20, 50]}
              getRowId={(s) => s.id}
              columns={[
                {
                  id: "student",
                  header: "Student",
                  accessorFn: (s) => s.full_name,
                  cell: ({ row }) => (
                    <div className="flex items-center gap-3">
                      <Avatar name={row.original.full_name} src={row.original.profile_picture} size="sm" />
                      <span className="font-semibold text-ink">{row.original.full_name}</span>
                    </div>
                  ),
                },
                { accessorKey: "admission_no", header: "Admission" },
                { accessorKey: "class_name", header: "Class" },
                {
                  id: "contact",
                  header: "Contacts",
                  enableSorting: false,
                  cell: ({ row }) => (
                    <div>
                      <div>{row.original.phone || "Not provided"}</div>
                      <div className="text-xs text-muted">{row.original.phone2 || "No secondary contact"}</div>
                    </div>
                  ),
                },
                {
                  id: "performance",
                  header: "Performance",
                  accessorFn: (s) => s.avg_score ?? -1,
                  cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                      <Badge tone="info" size="sm">
                        {row.original.avg_score != null ? row.original.avg_score.toFixed(2) : "No score"}
                      </Badge>
                      <Badge tone="gold" size="sm">
                        Grade {row.original.grade}
                      </Badge>
                    </div>
                  ),
                },
                {
                  id: "status",
                  header: "Status",
                  accessorFn: (s) => s.status,
                  cell: ({ row }) => (
                    <Badge tone={STUDENT_STATUS_TONE[row.original.status as keyof typeof STUDENT_STATUS_TONE] ?? "neutral"} dot>
                      {STUDENT_STATUS_LABEL[row.original.status as keyof typeof STUDENT_STATUS_LABEL] ?? row.original.status}
                    </Badge>
                  ),
                },
              ]}
              data={students}
              emptyState={
                <EmptyState
                  icon="solar:users-group-rounded-linear"
                  title="No students linked yet"
                  description="Students taught by this teacher's classes will appear here."
                />
              }
            />
          </section>
        </div>
      </div>
    </div>
  );
}
