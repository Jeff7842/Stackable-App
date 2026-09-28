"use client";

// Per-row quick actions: suspend / activate, open (view + edit) and delete.
// Delete is only offered to a super-admin (the API enforces the same rule).
// `locked` (your own account, or a super-admin you may not touch) hides
// suspend and delete.

import { Button, Icon } from "@/components/ui";
import type { AdminUser } from "@/hooks/useAdminUsers";
import { getFullName } from "./userUtils";

export interface RowActionsProps {
  user: AdminUser;
  canDelete: boolean;
  locked: boolean;
  busy: boolean;
  onOpen: (user: AdminUser) => void;
  onToggleSuspend: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}

export function RowActions({ user, canDelete, locked, busy, onOpen, onToggleSuspend, onDelete }: RowActionsProps) {
  const name = getFullName(user);
  const suspended = user.status === "suspended";
  const suspendLabel = suspended ? `Activate ${name}` : `Suspend ${name}`;

  return (
    <div className="flex items-center justify-end gap-1">
      {!locked ? (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={suspendLabel}
          title={suspendLabel}
          disabled={busy}
          onClick={() => onToggleSuspend(user)}
        >
          <Icon
            icon={suspended ? "solar:lock-keyhole-minimalistic-unlocked-linear" : "solar:lock-keyhole-minimalistic-linear"}
            width={16}
            className={suspended ? "text-success" : "text-warning"}
          />
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        iconOnly
        leftIcon="solar:pen-linear"
        aria-label={`Open ${name}`}
        title="View or edit"
        onClick={() => onOpen(user)}
      />

      {canDelete && !locked ? (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={`Delete ${name}`}
          title="Delete user"
          disabled={busy}
          onClick={() => onDelete(user)}
        >
          <Icon icon="solar:trash-bin-trash-linear" width={16} className="text-danger" />
        </Button>
      ) : null}
    </div>
  );
}

export default RowActions;
