"use client";

// Page-permission matrix: one on/off switch per page key.
// Semantics (same as the old page and the API guard): a page with no row is
// allowed; toggling writes an explicit row. Only admin-level roles use it.

import { useId } from "react";
import { Button, Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { AdminUserPermission } from "@/hooks/useAdminUsers";
import type { Role } from "@/lib/validation/shared";
import { Switch } from "./Switch";
import { isAdminLevel, isAllowed, pageLabel, setAccess, setAllAccess } from "./userUtils";

export interface PermissionMatrixProps {
  /** The role being edited: the matrix only applies to admin / super-admin. */
  role: Role;
  pageKeys: string[];
  value: AdminUserPermission[];
  onChange: (next: AdminUserPermission[]) => void;
  disabled?: boolean;
}

export function PermissionMatrix({ role, pageKeys, value, onChange, disabled }: PermissionMatrixProps) {
  const uid = useId();

  if (!isAdminLevel(role)) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-recessed p-4 text-sm text-ink-soft">
        <Icon icon="solar:shield-check-linear" width={20} className="mt-0.5 shrink-0 text-muted" />
        <p>
          Page permissions only apply to admin-level roles. Managers, teachers and students do not use this
          block.
        </p>
      </div>
    );
  }

  if (pageKeys.length === 0) {
    return <p className="rounded-2xl bg-recessed p-4 text-sm text-ink-soft">No pages available to configure.</p>;
  }

  const allowedCount = pageKeys.filter((key) => isAllowed(value, key)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft" aria-live="polite">
          <span className="font-display text-base font-semibold text-ink tabular-nums">{allowedCount}</span>
          {" "}of <span className="tabular-nums">{pageKeys.length}</span> pages allowed
        </p>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            leftIcon="solar:check-circle-linear"
            disabled={disabled}
            onClick={() => onChange(setAllAccess(pageKeys, true))}
          >
            Allow all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leftIcon="solar:forbidden-circle-linear"
            disabled={disabled}
            onClick={() => onChange(setAllAccess(pageKeys, false))}
          >
            Block all
          </Button>
        </div>
      </div>

      {role === "super-admin" ? (
        <p className="flex items-start gap-2 rounded-xl bg-info-tint px-3 py-2 text-xs font-medium text-info">
          <Icon icon="solar:shield-warning-linear" width={16} className="mt-px shrink-0" />
          Super-admins bypass page permissions, so these settings are stored but never enforced.
        </p>
      ) : null}

      <ul aria-label="Page access" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pageKeys.map((key) => {
          const allowed = isAllowed(value, key);
          const labelId = `${uid}-${key}`;
          return (
            <li
              key={key}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 shadow-soft ring-1 ring-ghost"
            >
              <div className="min-w-0">
                <p id={labelId} className="truncate text-sm font-semibold capitalize text-ink">
                  {pageLabel(key)}
                </p>
                <p className={cn("text-xs font-medium", allowed ? "text-success" : "text-danger")}>
                  {allowed ? "Allowed" : "Blocked"}
                </p>
              </div>
              <Switch
                checked={allowed}
                disabled={disabled}
                aria-labelledby={labelId}
                onCheckedChange={(next) => onChange(setAccess(value, key, next))}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PermissionMatrix;
