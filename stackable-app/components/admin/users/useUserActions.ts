"use client";

// One place for "do something to a user": run the mutation, ask for
// confirmation where it is destructive, and tell the person what happened
// (toasts). Components just call these and react to the boolean result.

import { useConfirmation } from "@/components/confirmation/ConfirmationProvider";
import { useToast } from "@/components/toast/ToastProvider";
import {
  useCreateAdminUser,
  useDeleteAdminUser,
  useUpdateAdminUser,
  type AdminUser,
  type CreateAdminUserInput,
  type UpdateAdminUserInput,
} from "@/hooks/useAdminUsers";
import { getFullName } from "./userUtils";

const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

export function useUserActions() {
  const { confirm } = useConfirmation();
  const { showToast } = useToast();
  const create = useCreateAdminUser();
  const update = useUpdateAdminUser();
  const remove = useDeleteAdminUser();

  /** The user a row-level request is currently working on (spinner / disabled state). */
  const busyId: string | null = update.isPending
    ? (update.variables?.id ?? null)
    : remove.isPending
      ? (remove.variables ?? null)
      : null;

  const isSaving = update.isPending;
  const isCreating = create.isPending;

  /** Suspend an active/pending user, or re-activate a suspended one. */
  async function toggleSuspend(user: AdminUser): Promise<boolean> {
    const nextStatus = user.status === "suspended" ? "active" : "suspended";
    try {
      await update.mutateAsync({ id: user.id, status: nextStatus });
      showToast({
        type: "success",
        title: nextStatus === "suspended" ? "User suspended" : "User activated",
        description: `${getFullName(user)} is now ${nextStatus}.`,
      });
      return true;
    } catch (error) {
      showToast({ type: "error", title: "Status update failed", description: messageOf(error, "Failed to update status.") });
      return false;
    }
  }

  /** Save edits from the drawer (the caller sends only what changed). */
  async function saveChanges(input: UpdateAdminUserInput): Promise<boolean> {
    try {
      await update.mutateAsync(input);
      showToast({ type: "success", title: "User updated", description: "The user changes were saved." });
      return true;
    } catch (error) {
      showToast({ type: "error", title: "Update failed", description: messageOf(error, "Failed to update user.") });
      return false;
    }
  }

  /** Permanently clear activity log, login history and notifications (asks first). */
  async function clearHistory(user: AdminUser): Promise<boolean> {
    const ok = await confirm({
      title: "Clear all history?",
      message: `This permanently deletes ${getFullName(user)}'s activity log, login history and notifications.`,
      confirmLabel: "Clear history",
      cancelLabel: "Cancel",
      tone: "danger",
    });
    if (!ok) return false;
    try {
      // The route always updates the users row, so include the current (unchanged) status.
      await update.mutateAsync({ id: user.id, status: user.status, clear_history: true });
      showToast({ type: "success", title: "History cleared", description: "User history was cleared." });
      return true;
    } catch (error) {
      showToast({ type: "error", title: "Update failed", description: messageOf(error, "Failed to clear history.") });
      return false;
    }
  }

  /** Delete a user for good (asks first). The server only lets a super-admin do this. */
  async function deleteUser(user: AdminUser): Promise<boolean> {
    const ok = await confirm({
      title: "Delete user?",
      message: `Delete ${getFullName(user)}? This action is permanent.`,
      confirmLabel: "Delete user",
      cancelLabel: "Cancel",
      tone: "danger",
    });
    if (!ok) return false;
    try {
      await remove.mutateAsync(user.id);
      showToast({ type: "success", title: "User deleted", description: `${getFullName(user)} was removed.` });
      return true;
    } catch (error) {
      showToast({ type: "error", title: "Delete failed", description: messageOf(error, "Failed to delete user.") });
      return false;
    }
  }

  async function createUser(input: CreateAdminUserInput): Promise<boolean> {
    try {
      await create.mutateAsync(input);
      showToast({
        type: "success",
        title: "User created",
        description: `${input.first_name} ${input.last_name}`.trim() || "The user was created.",
      });
      return true;
    } catch (error) {
      showToast({ type: "error", title: "Create user failed", description: messageOf(error, "Failed to create user.") });
      return false;
    }
  }

  return { busyId, isSaving, isCreating, toggleSuspend, saveChanges, clearHistory, deleteUser, createUser };
}
