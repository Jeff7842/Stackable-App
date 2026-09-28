"use client";

/**
 * Edit teacher (/dashboard/teachers/[id]/edit) - profile fields, subjects,
 * class-teacher ownership and the weekly timetable, saved together in one
 * PATCH. Converted from direct Supabase reads/writes across teachers,
 * classes, teacher_subjects and teacher_timetables (plus a direct storage
 * upload for the photo) to useTeacherEditData(id) + useUpdateTeacher()
 * (hooks/useTeachers.ts, Prisma/Neon backed, atomic on the server).
 *
 * Not carried over: the old page's "Verify email" / "Verify phone" buttons
 * called /api/teachers/[id]/send-email-verification and
 * .../send-phone-verification, routes that do not exist anywhere in this
 * codebase (grepped) - they always 404'd. The read-only "Switch to view"
 * toggle is also gone: the profile page (/dashboard/teachers/[id]) is now a
 * richer read view than that toggle ever was, so this page is edit-only,
 * matching how create/edit works everywhere else in the admin workspace.
 */
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConfirmation } from "@/components/confirmation/ConfirmationProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { Avatar, Badge, Button, EmptyState, Field, Input, Select, Skeleton } from "@/components/ui";
import {
  TEACHER_STATUSES,
  useTeacherEditData,
  useUpdateTeacher,
  type TeacherStatus,
  type TimetableSlot,
  type TimetableSlotInput,
} from "@/hooks/useTeachers";
import { TeacherStatusBadge } from "@/components/admin/teachers/StatusBadge";
import { TimetableEditor } from "@/components/admin/teachers/TimetableEditor";
import { STATUS_LABEL, classLabel, percentage } from "@/components/admin/teachers/utils";

type Draft = {
  name: string;
  email: string;
  phone: string;
  admission_number: string;
  status: TeacherStatus;
  class_teacher: boolean;
  class_teacher_class_id: string;
  subject_ids: number[];
  timetable: TimetableSlot[];
};

function toSlotInput(slot: TimetableSlot): TimetableSlotInput {
  return {
    class_id: slot.class_id,
    subject_id: slot.subject_id,
    day_of_week: slot.day_of_week,
    start_time: slot.start_time,
    end_time: slot.end_time,
    room: slot.room,
    item_type: slot.item_type,
    title: slot.title,
    notes: slot.notes,
  };
}

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

export default function TeacherEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { confirm } = useConfirmation();
  const { showToast } = useToast();

  const query = useTeacherEditData(id);
  const update = useUpdateTeacher();

  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [initial, setInitial] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  if (query.data && seededFor !== id) {
    const d = query.data;
    const seeded: Draft = {
      name: d.teacher.name,
      email: d.teacher.email ?? "",
      phone: d.teacher.phone ?? "",
      admission_number: d.teacher.admission_number,
      status: d.teacher.status as TeacherStatus,
      class_teacher: d.teacher.class_teacher,
      class_teacher_class_id: d.class_teacher_class_id ?? "",
      subject_ids: d.assigned_subject_ids,
      timetable: d.timetable,
    };
    setSeededFor(id);
    setInitial(seeded);
    setDraft(seeded);
  }

  if (query.isLoading || !draft || !initial) {
    return (
      <div className="space-y-5 pb-6">
        <Skeleton className="h-28" rounded="2xl" />
        <Skeleton className="h-64" rounded="2xl" />
        <Skeleton className="h-96" rounded="2xl" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
        <EmptyState
          icon="solar:danger-triangle-linear"
          title="Teacher not found"
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

  const { teacher, subjects, classes } = query.data;

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initial) || photo !== null;

  function patch(change: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...change } : d));
  }

  function toggleSubject(subjectId: number) {
    patch({
      subject_ids: draft!.subject_ids.includes(subjectId)
        ? draft!.subject_ids.filter((sid) => sid !== subjectId)
        : [...draft!.subject_ids, subjectId],
    });
  }

  async function requestStatusChange(next: TeacherStatus) {
    if (next === draft!.status) return;
    const accepted = await confirm({
      title: "Confirm status change",
      message: `Change teacher status from ${STATUS_LABEL[draft!.status]} to ${STATUS_LABEL[next]}?`,
      confirmLabel: "Change status",
      cancelLabel: "Cancel",
      tone: next === "suspended" || next === "terminated" ? "danger" : "primary",
    });
    if (!accepted) return;
    patch({ status: next });
  }

  function handlePhotoFile(file: File) {
    setPhoto(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  async function handleSave() {
    try {
      const result = await update.mutateAsync({
        id,
        changes: {
          name: draft!.name,
          email: draft!.email,
          phone: draft!.phone || null,
          admission_number: draft!.admission_number,
          status: draft!.status,
          class_teacher: draft!.class_teacher,
          class_teacher_class_id: draft!.class_teacher ? draft!.class_teacher_class_id || null : null,
          subject_ids: draft!.subject_ids,
          timetable: draft!.timetable.map(toSlotInput),
        },
        photo,
      });
      showToast({
        type: "success",
        title: "Teacher updated",
        description:
          result.timetable_conflicts.length > 0
            ? `Saved with ${result.timetable_conflicts.length} overlapping timetable slot${result.timetable_conflicts.length === 1 ? "" : "s"}.`
            : "Teacher profile and timetable changes were saved successfully.",
      });
      router.push(`/dashboard/teachers/${id}`);
    } catch (error) {
      showToast({ type: "error", title: "Save failed", description: errorText(error, "Failed to save teacher changes.") });
    }
  }

  // Classes available for "class teacher for": unowned, or already owned by this teacher.
  const availableClassTeacherClasses = classes.filter((c) => !c.class_teacher_id || c.class_teacher_id === id);
  const photoSrc = photoPreview ?? teacher.profile_photo;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <Button as="a" href={`/dashboard/teachers/${id}`} variant="ghost" size="sm" leftIcon="solar:arrow-left-linear">
          Back to teacher
        </Button>
        <div className="flex items-center gap-2">
          {dirty ? (
            <Button variant="ghost" disabled={update.isPending} onClick={() => { setDraft(initial); setPhoto(null); setPhotoPreview(null); }}>
              Reset
            </Button>
          ) : null}
          <Button leftIcon="solar:check-circle-linear" loading={update.isPending} disabled={!dirty} onClick={() => void handleSave()}>
            Save changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
            <div className="flex items-start gap-4">
              <Avatar name={draft.name || teacher.name} src={photoSrc} size="xl" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-lg font-semibold text-ink">{draft.name || "Unnamed teacher"}</h2>
                <p className="truncate text-sm text-ink-soft">{draft.email || "No email"}</p>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-recessed px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors duration-300 ease-standard hover:text-ink">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoFile(file);
                    }}
                  />
                  Change photo
                </label>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-recessed p-3">
                <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Attendance</p>
                <p className="mt-1 font-semibold text-ink">{percentage(teacher.attendance_percentage)}%</p>
              </div>
              <div className="rounded-xl bg-recessed p-3">
                <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Days present</p>
                <p className="mt-1 font-semibold text-ink">{teacher.days_present ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
            <h3 className="font-display text-base font-semibold text-ink">Status</h3>
            <p className="mt-1 text-sm text-ink-soft">Each change asks for confirmation before it applies.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {TEACHER_STATUSES.map((status) => {
                const selected = draft.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => void requestStatusChange(status)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-[translate] duration-300 ease-standard ${
                      selected ? "border-transparent" : "border-ghost text-ink-soft hover:-translate-y-0.5"
                    }`}
                  >
                    {selected ? <TeacherStatusBadge status={status} /> : STATUS_LABEL[status]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
            <h3 className="font-display text-base font-semibold text-ink">Teacher details</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
              </Field>
              <Field label="Admission number">
                <Input value={draft.admission_number} onChange={(e) => patch({ admission_number: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={draft.email} onChange={(e) => patch({ email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input value={draft.phone} onChange={(e) => patch({ phone: e.target.value })} />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
            <h3 className="font-display text-base font-semibold text-ink">Subjects</h3>
            <p className="mt-1 text-sm text-ink-soft">The first subject selected becomes the primary subject.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {subjects.map((subject) => {
                const index = draft.subject_ids.indexOf(subject.id);
                const selected = index !== -1;
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => toggleSubject(subject.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-300 ease-standard ${
                      selected ? "border-primary/30 bg-primary-tint text-primary-ink" : "border-ghost text-ink-soft hover:text-ink"
                    }`}
                  >
                    {subject.subject_name}
                    {selected && index === 0 ? " · Primary" : ""}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
            <h3 className="font-display text-base font-semibold text-ink">Class teacher ownership</h3>
            <label className="mt-3 flex items-center gap-3 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={draft.class_teacher}
                onChange={(e) => patch({ class_teacher: e.target.checked })}
                className="size-4 rounded border-ghost accent-[var(--primary)]"
              />
              Mark this teacher as a class teacher
            </label>
            <div className="mt-4 max-w-sm">
              <Field label="Class teacher for" hint={!draft.class_teacher ? "Enable the checkbox above to assign a class." : undefined}>
                <Select
                  value={draft.class_teacher_class_id}
                  disabled={!draft.class_teacher}
                  onChange={(e) => patch({ class_teacher_class_id: e.target.value })}
                >
                  <option value="">No class ownership</option>
                  {availableClassTeacherClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {teacher.class_teacher || draft.timetable.length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Classes taught (from timetable)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.from(new Set(draft.timetable.map((s) => s.class_id).filter(Boolean))).map((classId) => (
                    <Badge key={classId} tone="neutral">
                      {classLabel(classes.find((c) => c.id === classId))}
                    </Badge>
                  ))}
                  {draft.timetable.every((s) => !s.class_id) ? <span className="text-sm text-ink-soft">None yet - add class slots below.</span> : null}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
            <h3 className="font-display text-base font-semibold text-ink">Weekly timetable</h3>
            <div className="mt-4">
              <TimetableEditor
                slots={draft.timetable}
                onChange={(timetable) => patch({ timetable })}
                classes={classes}
                subjects={subjects}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
