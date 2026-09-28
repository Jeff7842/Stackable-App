"use client";

/**
 * StudentDrawer - the edit drawer opened from a row's pencil icon. The old
 * page linked "Edit" to a page that was never built (/dashboard/students/[id]/edit
 * 404s); useUpdateStudent already supports every field below, so this is a
 * genuinely new, working feature rather than a redesign of a broken one.
 *
 * Welfare fields (location, home address, emergency contact, health status,
 * other info) only exist on the full profile (GET /api/students/[id]), not on
 * the list row, so the form loads that first and seeds from it - never from
 * the list row - the same "don't blank fields the list doesn't carry" rule
 * the schools edit form follows (PATCH writes an omitted field as null).
 *
 * The parent mounts this with a fresh `key` per open, so state always starts
 * clean; it never unmounts on close, so the exit animation still shows the form.
 */
import { useState } from "react";
import { useConfirmation } from "@/components/confirmation/ConfirmationProvider";
import { Avatar, Badge, Button, Drawer, EmptyState, Field, Input, Select, Skeleton, Textarea } from "@/components/ui";
import {
  useStudent,
  type StudentClassOption,
  type StudentListItem,
  type StudentStatus,
  type StudentUpdateInput,
} from "@/hooks/useStudents";
import { StudentStatusBadge } from "./StatusBadge";
import type { StudentActions } from "./useStudentActions";
import { STATUS_LABEL, formatDate } from "./utils";

type Draft = {
  status: StudentStatus;
  class_id: string;
  phone: string;
  phone2: string;
  date_of_birth: string;
  location: string;
  home_address: string;
  emergency_contact: string;
  health_status: string;
  other_info: string;
};

/** Row fields come from the list; welfare fields come from the full profile (or blank while it loads). */
function toDraft(
  row: StudentListItem,
  profile: { location: string | null; home_address: string | null; emergency_contact: string | null; health_status: string | null; other_info: string | null } | null,
): Draft {
  return {
    status: row.status as StudentStatus,
    class_id: row.class_id ?? "",
    phone: row.phone ?? "",
    phone2: row.phone2 ?? "",
    date_of_birth: row.date_of_birth ?? "",
    location: profile?.location ?? "",
    home_address: profile?.home_address ?? "",
    emergency_contact: profile?.emergency_contact ?? "",
    health_status: profile?.health_status ?? "",
    other_info: profile?.other_info ?? "",
  };
}

const STATUSES = Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[];
const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

export interface StudentDrawerProps {
  student: StudentListItem;
  open: boolean;
  onClose: () => void;
  classes: StudentClassOption[];
  actions: StudentActions;
}

export function StudentDrawer({ student, open, onClose, classes, actions }: StudentDrawerProps) {
  const { confirm } = useConfirmation();
  const detail = useStudent(student.id);

  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [initial, setInitial] = useState<Draft>(() => toDraft(student, null));
  const [draft, setDraft] = useState<Draft>(() => toDraft(student, null));

  // Seed the welfare fields once the full profile arrives (never from placeholder data).
  const record = detail.data && !detail.isPlaceholderData ? detail.data.student : null;
  if (record && seededFor !== student.id) {
    const seeded = toDraft(student, record);
    setSeededFor(student.id);
    setInitial(seeded);
    setDraft(seeded);
  }

  const loadFailed = !record && detail.isError;
  const loadingRecord = !record && !detail.isError;

  const dirty = (Object.keys(draft) as (keyof Draft)[]).some((key) => draft[key] !== initial[key]);

  function patch(change: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...change }));
  }

  async function requestClose() {
    if (actions.isSaving) return;
    if (dirty) {
      const ok = await confirm({
        title: "Discard changes?",
        message: `You have unsaved changes to ${student.full_name}.`,
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        tone: "warning",
      });
      if (!ok) return;
    }
    onClose();
  }

  async function save() {
    const changes: StudentUpdateInput = {
      status: draft.status,
      class_id: draft.class_id || null,
      phone: draft.phone || null,
      phone2: draft.phone2 || null,
      date_of_birth: draft.date_of_birth || null,
      location: draft.location || null,
      home_address: draft.home_address || null,
      emergency_contact: draft.emergency_contact || null,
      health_status: draft.health_status || null,
      other_info: draft.other_info || null,
    };
    if (await actions.saveChanges(student.id, changes)) onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={() => void requestClose()}
      size="md"
      title="Edit student"
      subtitle="Class, status, contact and welfare details."
      footer={
        <>
          <Button variant="ghost" disabled={actions.isSaving} onClick={() => void requestClose()}>
            Cancel
          </Button>
          <Button
            leftIcon="solar:check-circle-linear"
            loading={actions.isSaving}
            disabled={!dirty || loadingRecord || loadFailed}
            onClick={() => void save()}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
          <Avatar name={student.full_name} src={student.profile_picture} size="xl" />
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl font-semibold text-ink">{student.full_name}</h3>
            <p className="truncate text-sm text-ink-soft">{student.admission_no}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <StudentStatusBadge status={student.status} />
              {student.average_grade ? <Badge tone="info">Avg {student.average_grade}</Badge> : null}
            </div>
            <p className="mt-2 text-xs text-muted">
              {student.school_name} · Joined {formatDate(student.created_at)}
            </p>
          </div>
        </div>

        <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
          <h4 className="font-display text-base font-semibold text-ink">Class & status</h4>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Class">
              <Select value={draft.class_id} onChange={(e) => patch({ class_id: e.target.value })}>
                <option value="">Unassigned</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={draft.status} onChange={(e) => patch({ status: e.target.value as Draft["status"] })}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
          <h4 className="font-display text-base font-semibold text-ink">Contact</h4>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Parent contact 1">
              <Input type="tel" value={draft.phone} onChange={(e) => patch({ phone: e.target.value })} />
            </Field>
            <Field label="Parent contact 2">
              <Input type="tel" value={draft.phone2} onChange={(e) => patch({ phone2: e.target.value })} />
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={draft.date_of_birth} onChange={(e) => patch({ date_of_birth: e.target.value })} />
            </Field>
            <Field label="Location">
              <Input value={draft.location} disabled={loadingRecord} onChange={(e) => patch({ location: e.target.value })} />
            </Field>
          </div>
        </section>

        {loadFailed ? (
          <EmptyState
            icon="solar:danger-triangle-linear"
            title="Could not load welfare details"
            description={errorText(detail.error, "Failed to load the full student profile.")}
            action={
              <Button variant="secondary" leftIcon="solar:refresh-linear" onClick={() => void detail.refetch()}>
                Try again
              </Button>
            }
          />
        ) : loadingRecord ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading student profile">
            <Skeleton className="h-32" rounded="2xl" />
          </div>
        ) : (
          <>
            <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
              <h4 className="font-display text-base font-semibold text-ink">Address & emergency</h4>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Home address" className="sm:col-span-2">
                  <Input value={draft.home_address} onChange={(e) => patch({ home_address: e.target.value })} />
                </Field>
                <Field label="Emergency contact" className="sm:col-span-2">
                  <Input value={draft.emergency_contact} onChange={(e) => patch({ emergency_contact: e.target.value })} />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
              <h4 className="font-display text-base font-semibold text-ink">Welfare & notes</h4>
              <div className="mt-4 space-y-4">
                <Field label="Health status" hint="Allergies, conditions or medication to be aware of.">
                  <Textarea rows={2} value={draft.health_status} onChange={(e) => patch({ health_status: e.target.value })} />
                </Field>
                <Field label="Other info">
                  <Textarea rows={3} value={draft.other_info} onChange={(e) => patch({ other_info: e.target.value })} />
                </Field>
              </div>
            </section>
          </>
        )}
      </div>
    </Drawer>
  );
}

export default StudentDrawer;
