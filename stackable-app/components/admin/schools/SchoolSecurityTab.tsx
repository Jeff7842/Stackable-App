"use client";

/**
 * SchoolSecurityTab - the "Security" tab of the detail drawer:
 *   1. School code: the code, copy, how many of the 3 regenerations are used,
 *      the queued change date, and Regenerate (admin + super-admin).
 *   2. Security codes PDF (super-admin only) - see SecurityCodesPanel.
 *   3. Danger zone: delete the school (super-admin only).
 * The server enforces every one of these; the role only decides what is shown.
 */
import { Button, Icon } from "@/components/ui";
import type { SchoolDetails } from "@/hooks/useSchools";
import { SecurityCodesPanel } from "./SecurityCodesPanel";
import type { SchoolPermissions } from "./permissions";
import type { SchoolActions } from "./useSchoolActions";
import { MAX_CODE_CHANGES, formatDate } from "./utils";

export function SchoolSecurityTab({
  school,
  permissions,
  actions,
}: {
  school: SchoolDetails;
  permissions: SchoolPermissions;
  actions: SchoolActions;
}) {
  const used = Math.min(MAX_CODE_CHANGES, school.code_change_count ?? 0);
  const busy = actions.busyId === school.id;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">School code</p>
            <p className="mt-1 font-display text-3xl font-semibold tracking-wide text-ink tabular-nums">{school.code}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            rightIcon="solar:copy-linear"
            onClick={() => void actions.copyCode(school.code)}
          >
            Copy code
          </Button>
        </div>

        {/* Regeneration budget: three pips, filled = used. */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex gap-1.5" role="img" aria-label={`${used} of ${MAX_CODE_CHANGES} code changes used`}>
            {Array.from({ length: MAX_CODE_CHANGES }).map((_, i) => (
              <span
                key={i}
                className={i < used ? "h-1.5 w-8 rounded-full bg-warning" : "h-1.5 w-8 rounded-full bg-field"}
              />
            ))}
          </div>
          <p className="text-sm text-ink-soft tabular-nums">
            <span className="font-semibold text-ink">
              {used}/{MAX_CODE_CHANGES}
            </span>{" "}
            code changes used
          </p>
        </div>

        {school.pending_code_change_at ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-info">
            <Icon icon="solar:clock-circle-linear" width={16} />
            Code change queued for {formatDate(school.pending_code_change_at)}
          </p>
        ) : null}

        {permissions.canWrite ? (
          <div className="mt-5">
            <Button
              variant="secondary"
              leftIcon="solar:restart-linear"
              loading={busy}
              disabled={used >= MAX_CODE_CHANGES}
              onClick={() => void actions.regenerateCode(school)}
            >
              Regenerate school code
            </Button>
            <p className="mt-2 text-xs text-muted">Each school only gets {MAX_CODE_CHANGES} regeneration attempts.</p>
          </div>
        ) : null}
      </section>

      {permissions.canSecurityCodes ? (
        <SecurityCodesPanel school={school} actions={actions} />
      ) : (
        <p className="flex items-start gap-2 rounded-2xl bg-recessed p-4 text-sm text-ink-soft">
          <Icon icon="solar:shield-keyhole-linear" width={18} className="mt-0.5 shrink-0" />
          Security codes are only available to platform super-admins.
        </p>
      )}

      {permissions.canDelete ? (
        <section className="rounded-2xl bg-danger-tint p-5">
          <h3 className="font-display text-base font-semibold text-danger">Danger zone</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Deleting a school removes its record. This action cannot be undone.
          </p>
          <div className="mt-4">
            <Button variant="danger" leftIcon="solar:trash-bin-trash-linear" loading={busy} onClick={() => void actions.remove(school)}>
              Delete school
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
