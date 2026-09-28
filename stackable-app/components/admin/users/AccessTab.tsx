"use client";

// "Role & status" tab: role, status, the "must change password" flag, and the
// destructive actions (clear history, delete). Delete is super-admin only.

import { useId } from "react";
import { Button, Field, Icon, Select } from "@/components/ui";
import type { AdminUser } from "@/hooks/useAdminUsers";
import type { Role, UserStatus } from "@/lib/validation/shared";
import { Section } from "./Section";
import { Switch } from "./Switch";
import { ROLE_LABEL, STATUSES, STATUS_LABEL, type UserDraft } from "./userUtils";

export interface AccessTabProps {
  user: AdminUser;
  draft: UserDraft;
  onDraftChange: (patch: Partial<UserDraft>) => void;
  roleOptions: Role[];
  /** Whole form is read-only (a super-admin viewed by a non-super-admin). */
  readOnly: boolean;
  /** Role / status / access / danger actions are locked (own account, or read-only). */
  lockAccess: boolean;
  isSelf: boolean;
  canDelete: boolean;
  busy: boolean;
  onClearHistory: () => void;
  onDelete: () => void;
}

export function AccessTab({
  user,
  draft,
  onDraftChange,
  roleOptions,
  readOnly,
  lockAccess,
  isSelf,
  canDelete,
  busy,
  onClearHistory,
  onDelete,
}: AccessTabProps) {
  const pwId = useId();

  return (
    <div className="space-y-5">
      {lockAccess ? (
        <p className="flex items-start gap-2 rounded-xl bg-info-tint px-3 py-2.5 text-sm font-medium text-info">
          <Icon icon="solar:shield-warning-linear" width={18} className="mt-px shrink-0" />
          {isSelf
            ? "This is your own account. You can't change its role, status or page access here."
            : "Only a super-admin can change a super-admin account."}
        </p>
      ) : null}

      <Section title="Role & status" description="What this person is, and whether they can sign in.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Role">
            <Select
              value={draft.role}
              disabled={lockAccess}
              onChange={(e) => onDraftChange({ role: e.target.value as Role })}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              disabled={lockAccess}
              onChange={(e) => onDraftChange({ status: e.target.value as UserStatus })}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p id={pwId} className="text-sm font-semibold text-ink">
              Password change required
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {draft.must_change_password ? "Required: they must set a new password when they sign in." : "Cleared: they can keep their current password."}
            </p>
          </div>
          <Switch
            checked={draft.must_change_password}
            disabled={readOnly}
            aria-labelledby={pwId}
            onCheckedChange={(next) => onDraftChange({ must_change_password: next })}
          />
        </div>
      </Section>

      {!lockAccess ? (
        <Section title="Danger zone" description="These actions cannot be undone.">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Clear all history</p>
                <p className="mt-0.5 text-xs text-ink-soft">Deletes the activity log, login history and notifications.</p>
              </div>
              <Button variant="secondary" size="sm" leftIcon="solar:eraser-linear" disabled={busy} onClick={onClearHistory}>
                Clear history
              </Button>
            </div>

            {canDelete ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">Delete user</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Permanently removes {user.first_name || "this user"}. Only super-admins can do this.
                  </p>
                </div>
                <Button variant="danger" size="sm" leftIcon="solar:trash-bin-trash-linear" disabled={busy} onClick={onDelete}>
                  Delete user
                </Button>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

export default AccessTab;
