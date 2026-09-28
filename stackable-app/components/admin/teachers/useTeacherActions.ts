"use client";

/**
 * useTeacherActions - every "do something to a teacher" flow in one place:
 * mutate (hooks/useTeachers) -> toast, confirming the destructive one
 * (delete, including the "this teacher has graded results" force-delete
 * follow-up prompt the API's 409 asks for). Suspend / activate is reversible
 * and does not interrupt with a confirm dialog (matches the users page).
 */
import { useConfirmation } from "@/components/confirmation/ConfirmationProvider";
import { useToast } from "@/components/toast/ToastProvider";
import {
  isGradingReportsConflict,
  useDeleteTeacher,
  useUpdateTeacher,
  type TeacherListItem,
} from "@/hooks/useTeachers";

export type TeacherActions = ReturnType<typeof useTeacherActions>;

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useTeacherActions({ onDeleted }: { onDeleted?: (id: string) => void } = {}) {
  const { confirm } = useConfirmation();
  const { showToast } = useToast();
  const update = useUpdateTeacher();
  const remove = useDeleteTeacher();

  const busyId: string | null = update.isPending
    ? (update.variables?.id ?? null)
    : remove.isPending
      ? (remove.variables?.id ?? null)
      : null;

  async function toggleStatus(teacher: TeacherListItem) {
    const nextStatus = teacher.status === "suspended" ? "active" : "suspended";
    try {
      await update.mutateAsync({ id: teacher.id, changes: { status: nextStatus } });
      showToast({
        type: "success",
        title: nextStatus === "suspended" ? "Teacher suspended" : "Teacher activated",
        description: `${teacher.name} is now ${nextStatus.replace("_", " ")}.`,
      });
    } catch (error) {
      showToast({ type: "error", title: "Status update failed", description: messageOf(error, `Could not update ${teacher.name}.`) });
    }
  }

  async function removeTeacher(teacher: TeacherListItem, force = false) {
    try {
      await remove.mutateAsync({ id: teacher.id, force });
      onDeleted?.(teacher.id);
      showToast({ type: "success", title: "Teacher deleted", description: `${teacher.name} was removed successfully.` });
      return true;
    } catch (error) {
      const gradingReports = isGradingReportsConflict(error);
      if (gradingReports !== null) {
        const forceOk = await confirm({
          title: "Teacher has graded results",
          message: `${teacher.name} recorded ${gradingReports} graded result${gradingReports === 1 ? "" : "s"}. Deleting this teacher also deletes those results. Delete anyway?`,
          confirmLabel: "Delete anyway",
          cancelLabel: "Cancel",
          tone: "danger",
        });
        if (forceOk) return removeTeacher(teacher, true);
        return false;
      }
      showToast({ type: "error", title: "Delete failed", description: messageOf(error, `Could not delete ${teacher.name}.`) });
      return false;
    }
  }

  async function deleteTeacher(teacher: TeacherListItem) {
    const ok = await confirm({
      title: "Delete teacher?",
      message: `Delete ${teacher.name}? This action cannot be undone.`,
      confirmLabel: "Delete teacher",
      cancelLabel: "Cancel",
      tone: "danger",
    });
    if (!ok) return;
    await removeTeacher(teacher);
  }

  return { busyId, isSaving: update.isPending, toggleStatus, deleteTeacher };
}
