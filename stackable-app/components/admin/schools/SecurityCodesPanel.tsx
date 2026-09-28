"use client";

/**
 * SecurityCodesPanel - the "security codes" card (super-admin only).
 *
 * How the flow works today (unchanged from the old page): the API answers
 * GET /api/school/[id]/security-codes with a PDF, never with the codes as
 * text. So the only safe operation is "download the PDF"; the codes are never
 * shown on screen, never copied to the clipboard and never held in memory or a
 * query cache (useDownloadSchoolSecurityCodes revokes the blob right after the
 * browser starts the download).
 *
 * A masked "reveal on click / copy / auto-hide" view would need a JSON variant
 * of that route. See the API-gap note in the lane report.
 */
import { Badge, Button, Icon } from "@/components/ui";
import type { SchoolActionTarget, SchoolActions } from "./useSchoolActions";

/**
 * Display names of the five codes inside the PDF. Mirrors
 * SCHOOL_SECURITY_CODE_LABELS in lib/school-security.ts (labels only, no
 * values). Not imported from there because that module pulls in Node's `crypto`.
 */
const CODE_LABELS = [
  "Billing auth",
  "Staff reset auth",
  "Results release auth",
  "High risk delete auth",
  "Ownership transfer auth",
] as const;

export function SecurityCodesPanel({
  school,
  actions,
}: {
  school: Pick<SchoolActionTarget, "id" | "name">;
  actions: SchoolActions;
}) {
  const busy = actions.busyId === school.id;

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary-ink">
          <Icon icon="solar:shield-keyhole-linear" width={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold text-ink">Security codes</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Five recovery codes protect this school&apos;s high-risk actions. They are only available as a PDF, generated
            on request.
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Codes included in the PDF">
        {CODE_LABELS.map((label) => (
          <li key={label}>
            <Badge tone="neutral" icon="solar:key-linear">
              {label}
            </Badge>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-warning-tint p-3.5 text-sm text-ink-soft">
        <Icon icon="solar:danger-triangle-linear" width={18} className="mt-0.5 shrink-0 text-warning" />
        <p>
          Treat the PDF like a password. Store it somewhere safe and never share it over chat or email. Every download
          generates a fresh file; nothing is kept on this screen.
        </p>
      </div>

      <div className="mt-4">
        <Button
          variant="secondary"
          leftIcon="solar:download-minimalistic-linear"
          loading={busy}
          onClick={() => void actions.downloadSecurityCodes(school)}
        >
          Download security codes PDF
        </Button>
      </div>
    </section>
  );
}
