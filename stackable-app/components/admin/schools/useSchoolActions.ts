"use client";

/**
 * useSchoolActions - every "do something to a school" flow in one place:
 * confirm (ConfirmationProvider) -> mutate (hooks/useSchools) -> toast.
 *
 * The page creates ONE instance and hands it to the table, the grid and the
 * drawer, so the confirm texts and toasts are identical everywhere (they are
 * the same wording the old page used). `busyId` is the school currently being
 * changed, used to disable its buttons.
 */
import { useState } from "react";
import { useConfirmation } from "@/components/confirmation/ConfirmationProvider";
import { useToast } from "@/components/toast/ToastProvider";
import {
  useDeleteSchool,
  useDownloadSchoolSecurityCodes,
  useSchoolAction,
  type SchoolRow,
} from "@/hooks/useSchools";

/** The few fields the actions need (a list row or a detail record both fit). */
export type SchoolActionTarget = Pick<SchoolRow, "id" | "name" | "status">;

export type SchoolActions = ReturnType<typeof useSchoolActions>;

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useSchoolActions({ onDeleted }: { onDeleted?: (id: string) => void } = {}) {
  const { confirm } = useConfirmation();
  const { showToast } = useToast();
  const actionMutation = useSchoolAction();
  const deleteMutation = useDeleteSchool();
  const downloadMutation = useDownloadSchoolSecurityCodes();
  const [busyId, setBusyId] = useState<string | null>(null);

  const success = (title: string, description?: string) => showToast({ type: "success", title, description });
  const failure = (title: string, error: unknown, fallback: string) =>
    showToast({ type: "error", title, description: messageOf(error, fallback) });

  /** Marks a school busy while `task` runs, and always clears it again. */
  async function run(id: string, task: () => Promise<void>) {
    setBusyId(id);
    try {
      await task();
    } finally {
      setBusyId(null);
    }
  }

  /** Suspend (queued by the server) or, for a suspended school, activate. */
  async function toggleStatus(school: SchoolActionTarget) {
    const activating = school.status === "suspended";
    const accepted = await confirm({
      title: activating ? "Activate school?" : "Suspend school?",
      message: activating
        ? `Activate ${school.name} now?`
        : `Suspend ${school.name}? This will queue the status update for this school.`,
      confirmLabel: activating ? "Activate" : "Suspend",
      tone: activating ? "primary" : "warning",
    });
    if (!accepted) return;

    await run(school.id, async () => {
      try {
        await actionMutation.mutateAsync({ id: school.id, action: activating ? "activate" : "suspend" });
        success(
          activating ? "School activated" : "School suspended",
          activating ? "The school is now active." : "The school status update has been queued.",
        );
      } catch (error) {
        failure("Status update failed", error, "Failed to update school status.");
      }
    });
  }

  /** +50 users, spread over the categories by the server. */
  async function increaseCapacity(school: SchoolActionTarget) {
    const accepted = await confirm({
      title: "Increase school capacity?",
      message: `Increase ${school.name} by 50 users and distribute the extra capacity across the school categories?`,
      confirmLabel: "Increase capacity",
      tone: "primary",
    });
    if (!accepted) return;

    await run(school.id, async () => {
      try {
        await actionMutation.mutateAsync({ id: school.id, action: "increase_capacity_50" });
        success("Capacity updated", "The school capacity increased by 50 users.");
      } catch (error) {
        failure("Capacity update failed", error, "Failed to increase users.");
      }
    });
  }

  /** Queue a new school code (max 3 per school; the server enforces it). */
  async function regenerateCode(school: SchoolActionTarget) {
    const accepted = await confirm({
      title: "Regenerate school code?",
      message: `Queue a new code for ${school.name}? Each school only gets 3 code regeneration attempts.`,
      confirmLabel: "Regenerate code",
      tone: "warning",
    });
    if (!accepted) return;

    await run(school.id, async () => {
      try {
        const res = await actionMutation.mutateAsync({ id: school.id, action: "regenerate_code" });
        success("Code regeneration queued", res?.message || "The school code update was queued successfully.");
      } catch (error) {
        failure("Code regeneration failed", error, "Failed to queue code regeneration.");
      }
    });
  }

  /** Permanently delete (super-admin only on the server). */
  async function remove(school: SchoolActionTarget) {
    const accepted = await confirm({
      title: "Delete school?",
      message: `Delete ${school.name}? This action cannot be undone.`,
      confirmLabel: "Delete school",
      tone: "danger",
    });
    if (!accepted) return;

    await run(school.id, async () => {
      try {
        await deleteMutation.mutateAsync(school.id);
        onDeleted?.(school.id);
        success("School deleted", "The school record was removed.");
      } catch (error) {
        failure("Delete failed", error, "Failed to delete school.");
      }
    });
  }

  /** Download the security-codes PDF (super-admin only on the server). Nothing is kept in memory afterwards. */
  async function downloadSecurityCodes(school: Pick<SchoolActionTarget, "id" | "name">) {
    await run(school.id, async () => {
      try {
        await downloadMutation.mutateAsync({ id: school.id, name: school.name });
        success("PDF downloaded", "Your school security codes PDF has been downloaded.");
      } catch (error) {
        failure("Download failed", error, "Failed to download security codes.");
      }
    });
  }

  /** Copy a (non-secret) school code to the clipboard. */
  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      success("Code copied", `${code} is on your clipboard.`);
    } catch {
      showToast({ type: "error", title: "Copy failed", description: "Your browser blocked clipboard access." });
    }
  }

  return { busyId, toggleStatus, increaseCapacity, regenerateCode, remove, downloadSecurityCodes, copyCode };
}
