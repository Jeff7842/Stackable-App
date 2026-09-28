"use client";

/**
 * Student profile (/dashboard/students/[id]) - full record for one student:
 * identity, class placement, contacts, welfare notes, guardians, subjects,
 * recent grades and attendance.
 *
 * Converted from a server component with a direct Supabase query to a client
 * page on GET /api/students/[id] via useStudent(id) (hooks/useStudents.ts,
 * already built - Prisma/Neon backed). Guardians, subjects, recent grades and
 * attendance are new here: the old page only showed the student row plus one
 * average-grade lookup.
 */
import { useParams } from "next/navigation";
import { Avatar, Badge, Button, DataTable, EmptyState, Skeleton } from "@/components/ui";
import { useStudent, type StudentGrade } from "@/hooks/useStudents";
import { StudentStatusBadge } from "@/components/admin/students/StatusBadge";
import { formatDate } from "@/components/admin/students/utils";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost">
      <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value || "—"}</p>
    </div>
  );
}

export default function StudentProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  const { data, isLoading, isError, error, refetch } = useStudent(id);

  if (isLoading) {
    return (
      <div className="space-y-5 pb-6">
        <Skeleton className="h-32" rounded="2xl" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
          <Skeleton className="h-64" rounded="2xl" />
          <Skeleton className="h-64" rounded="2xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
        <EmptyState
          icon="solar:danger-triangle-linear"
          title="Student not found"
          description={error instanceof Error ? error.message : "The requested student record could not be loaded."}
          action={
            <Button variant="secondary" leftIcon="solar:refresh-linear" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const { student, average, guardians, subjects, recent_grades, attendance } = data;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <Button as="a" href="/dashboard/students" variant="ghost" size="sm" leftIcon="solar:arrow-left-linear">
          Back to students
        </Button>
        <StudentStatusBadge status={student.status} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl bg-surface p-6 shadow-soft ring-1 ring-ghost">
            <div className="flex flex-col items-center text-center">
              <Avatar name={student.full_name} src={student.profile_picture} size="xl" />
              <h2 className="mt-4 font-display text-xl font-semibold text-ink">{student.full_name}</h2>
              <p className="mt-1 text-sm text-ink-soft">{student.admission_no}</p>
              <div className="mt-4 grid w-full grid-cols-2 gap-3 text-left">
                <div className="rounded-xl bg-recessed p-3">
                  <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Average grade</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{average.grade ?? "—"}</p>
                </div>
                <div className="rounded-xl bg-recessed p-3">
                  <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Attendance</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{attendance.rate}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
            <h3 className="font-display text-base font-semibold text-ink">Guardians</h3>
            {guardians.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No guardians linked yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {guardians.map((guardian) => (
                  <li key={guardian.parent_id} className="rounded-xl bg-recessed p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{guardian.name}</p>
                      {guardian.is_primary ? <Badge tone="info" size="sm">Primary</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft capitalize">{guardian.relationship}</p>
                    <p className="mt-1 text-xs text-muted">{guardian.phone || guardian.email || "No contact on file"}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
            <h3 className="font-display text-base font-semibold text-ink">School details</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Fact label="School" value={student.school_name} />
              <Fact label="Class" value={student.class_label ?? "Unassigned"} />
              <Fact label="Class teacher" value={student.class_teacher_name ?? "—"} />
              <Fact label="Date of birth" value={formatDate(student.date_of_birth)} />
              <Fact label="Joined" value={formatDate(student.created_at)} />
              <Fact label="Status" value={student.status} />
            </div>
          </section>

          <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
            <h3 className="font-display text-base font-semibold text-ink">Contact & welfare</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Fact label="Parent contact 1" value={student.phone ?? ""} />
              <Fact label="Parent contact 2" value={student.phone2 ?? ""} />
              <Fact label="Email" value={student.email ?? ""} />
              <Fact label="Location" value={student.location ?? ""} />
              <Fact label="Home address" value={student.home_address ?? ""} />
              <Fact label="Emergency contact" value={student.emergency_contact ?? ""} />
              <Fact label="Health status" value={student.health_status ?? ""} />
              <Fact label="Other info" value={student.other_info ?? ""} />
            </div>
          </section>

          <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
            <h3 className="font-display text-base font-semibold text-ink">Subjects</h3>
            {subjects.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No subjects assigned yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {subjects.map((subject) => (
                  <Badge key={subject.subject_id} tone="neutral">
                    {subject.subject_name}
                    {subject.teacher_name ? ` · ${subject.teacher_name}` : ""}
                  </Badge>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
            <div className="p-5 pb-0">
              <h3 className="font-display text-base font-semibold text-ink">Recent grades</h3>
            </div>
            <DataTable<StudentGrade>
              caption="Recent grades"
              searchable={false}
              getRowId={(g) => `${g.subject_id}-${g.term}-${g.created_at}`}
              columns={[
                { accessorKey: "subject_name", header: "Subject" },
                { accessorKey: "term", header: "Term" },
                { accessorKey: "grade", header: "Grade", meta: { className: "font-semibold text-ink" } },
                {
                  id: "score",
                  header: "Score",
                  accessorFn: (g) => g.normalized_pct ?? g.raw_score ?? null,
                  cell: (c) => (c.getValue<number | null>() != null ? `${c.getValue<number | null>()}%` : "—"),
                },
                {
                  id: "date",
                  header: "Recorded",
                  accessorFn: (g) => g.created_at ?? "",
                  cell: (c) => formatDate(c.getValue<string>() || null),
                },
              ]}
              data={recent_grades}
              emptyState={
                <EmptyState icon="solar:notebook-linear" title="No graded work yet" description="Grades will appear here once recorded." />
              }
            />
          </section>
        </div>
      </div>
    </div>
  );
}
