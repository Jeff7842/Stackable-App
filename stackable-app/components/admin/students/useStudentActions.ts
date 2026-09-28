"use client";

/**
 * useStudentActions - every "do something to a student" flow in one place:
 * mutate (hooks/useStudents) -> toast, confirming only the destructive one
 * (delete). Suspend / activate and drawer saves are reversible so they do not
 * interrupt with a confirm dialog (matches the admin-role users page).
 */
import { useState } from "react";
import { useConfirmation } from "@/components/confirmation/ConfirmationProvider";
import { useToast } from "@/components/toast/ToastProvider";
import {
  useDeleteStudent,
  useUpdateStudent,
  type StudentListItem,
  type StudentUpdateInput,
} from "@/hooks/useStudents";

export type StudentActions = ReturnType<typeof useStudentActions>;

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function fullName(student: Pick<StudentListItem, "full_name">) {
  return student.full_name;
}

export function useStudentActions({ onDeleted }: { onDeleted?: (id: string) => void } = {}) {
  const { confirm } = useConfirmation();
  const { showToast } = useToast();
  const update = useUpdateStudent();
  const remove = useDeleteStudent();
  const [busyId, setBusyId] = useState<string | null>(null);

  const isSaving = update.isPending;

  async function toggleStatus(student: StudentListItem) {
    const nextStatus = student.status === "suspended" ? "active" : "suspended";
    setBusyId(student.id);
    try {
      await update.mutateAsync({ id: student.id, changes: { status: nextStatus } });
      showToast({
        type: "success",
        title: nextStatus === "suspended" ? "Student suspended" : "Student activated",
        description: `${fullName(student)} is now ${nextStatus}.`,
      });
    } catch (error) {
      showToast({ type: "error", title: "Status update failed", description: messageOf(error, `Could not update ${fullName(student)}.`) });
    } finally {
      setBusyId(null);
    }
  }

  /** Save edits from the drawer. Returns whether it succeeded. */
  async function saveChanges(id: string, changes: StudentUpdateInput): Promise<boolean> {
    try {
      await update.mutateAsync({ id, changes });
      showToast({ type: "success", title: "Student updated", description: "The student changes were saved." });
      return true;
    } catch (error) {
      showToast({ type: "error", title: "Update failed", description: messageOf(error, "Failed to save student changes.") });
      return false;
    }
  }

  async function deleteStudent(student: StudentListItem) {
    const ok = await confirm({
      title: "Delete student?",
      message: `Delete ${fullName(student)}? This action cannot be undone.`,
      confirmLabel: "Delete student",
      cancelLabel: "Cancel",
      tone: "danger",
    });
    if (!ok) return;

    setBusyId(student.id);
    try {
      await remove.mutateAsync(student.id);
      onDeleted?.(student.id);
      showToast({ type: "success", title: "Student deleted", description: `${fullName(student)} was removed successfully.` });
    } catch (error) {
      showToast({ type: "error", title: "Delete failed", description: messageOf(error, `Could not delete ${fullName(student)}.`) });
    } finally {
      setBusyId(null);
    }
  }

  return { busyId, isSaving, toggleStatus, saveChanges, deleteStudent };
}
