"use client";

/**
 * Teacher timetable (/dashboard/teachers/[id]/timetable) - a focused view of
 * one teacher's weekly schedule, editable and saved on its own (separate from
 * the bigger teacher edit page, which also embeds TimetableEditor).
 *
 * Converted from a direct Supabase read (teachers, teacher_timetables, classes,
 * subjects) to useTeacherTimetable(id) + useSaveTeacherTimetable()
 * (hooks/useTeachers.ts, Prisma/Neon backed).
 */
import { useParams } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { Avatar, Badge, Button, EmptyState, Skeleton } from "@/components/ui";
import { useSaveTeacherTimetable, useTeacherTimetable, type TimetableSlot } from "@/hooks/useTeachers";
import { TeacherStatusBadge } from "@/components/admin/teachers/StatusBadge";
import { TimetableEditor } from "@/components/admin/teachers/TimetableEditor";

function slotsEqual(a: TimetableSlot[], b: TimetableSlot[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function TeacherTimetablePage() {
  const params = useParams();
  const id = params?.id as string;
  const { showToast } = useToast();

  const query = useTeacherTimetable(id);
  const save = useSaveTeacherTimetable();

  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [initial, setInitial] = useState<TimetableSlot[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);

  if (query.data && seededFor !== id) {
    setSeededFor(id);
    setInitial(query.data.slots);
    setSlots(query.data.slots);
  }

  const dirty = !slotsEqual(slots, initial);

  async function handleSave() {
    try {
      const result = await save.mutateAsync({ id, slots });
      setInitial(result.slots);
      setSlots(result.slots);
      showToast({
        type: "success",
        title: "Timetable saved",
        description:
          result.conflicts.length > 0
            ? `Saved with ${result.conflicts.length} overlapping slot${result.conflicts.length === 1 ? "" : "s"} - review before publishing.`
            : "The weekly timetable was saved.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Save failed",
        description: error instanceof Error && error.message ? error.message : "Failed to save the timetable.",
      });
    }
  }

  if (query.isLoading) {
    return (
      <div className="space-y-5 pb-6">
        <Skeleton className="h-28" rounded="2xl" />
        <Skeleton className="h-96" rounded="2xl" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
        <EmptyState
          icon="solar:danger-triangle-linear"
          title="Timetable could not be loaded"
          description={query.error instanceof Error ? query.error.message : "The requested teacher record could not be loaded."}
          action={
            <Button variant="secondary" leftIcon="solar:refresh-linear" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const { teacher, classes, subjects } = query.data;

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
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button as="a" href={`/dashboard/teachers/${id}`} variant="ghost" leftIcon="solar:arrow-left-linear">
            Back to teacher
          </Button>
          <Button as="a" href={`/dashboard/teachers/${id}/edit`} variant="secondary" leftIcon="solar:pen-2-linear">
            Edit teacher
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-ink">Weekly timetable</h3>
            <p className="mt-1 text-sm text-ink-soft">{slots.length} scheduled item{slots.length === 1 ? "" : "s"}.</p>
          </div>
          <div className="flex items-center gap-2">
            {dirty ? (
              <Button variant="ghost" leftIcon="solar:restart-linear" disabled={save.isPending} onClick={() => setSlots(initial)}>
                Reset
              </Button>
            ) : null}
            <Button leftIcon="solar:check-circle-linear" loading={save.isPending} disabled={!dirty} onClick={() => void handleSave()}>
              Save timetable
            </Button>
          </div>
        </div>

        <TimetableEditor slots={slots} onChange={setSlots} classes={classes} subjects={subjects} />
      </div>
    </div>
  );
}
