"use client";

// =============================================================================
// ImpersonateDrawer - "View as <name>".
// -----------------------------------------------------------------------------
// target summary card, a REQUIRED reason (10-500 chars, live counter, inline error
// under 10), a plain warning that everything is recorded, then "Start viewing".
//
// On success the hook wipes the TanStack cache and does a full window.location
// navigation to the server's redirectTo (the server layouts must re-run under the
// new identity). We only add the toast and keep the button in its loading state
// while the browser navigates, so a second click cannot start a second session.
//
// Server errors (403 / 404 / 409 / 429 / 503 ...) are shown as-is in an inline
// alert inside the drawer.
//
// State lives here, so the parent gives this component a fresh `key` for every
// opening (a new target or a reopened drawer starts with an empty reason).
// =============================================================================

import { useId, useState } from "react";
import { Avatar, Badge, Button, Drawer, Field, Icon, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast/ToastProvider";
import { useDevImpersonate } from "@/hooks/useDevImpersonate";
import type { DevUserRow } from "@/lib/dev-types";
import { cn } from "@/lib/cn";
import { errorMessage, errorTitle } from "./ErrorPanel";
import { fullName, roleLabel, roleTone } from "./format";

export const REASON_MIN = 10;
export const REASON_MAX = 500;

export function ImpersonateDrawer({
  user,
  open,
  onClose,
}: {
  user: DevUserRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const name = user ? fullName(user) : "user";

  const impersonate = useDevImpersonate({
    onStarted: () => {
      setRedirecting(true);
      showToast({ type: "success", title: `Now viewing as ${name}`, description: "Switching accounts..." });
    },
  });

  const trimmed = reason.trim();
  const valid = trimmed.length >= REASON_MIN && trimmed.length <= REASON_MAX;
  const showReasonError = touched && trimmed.length < REASON_MIN;
  const busy = impersonate.isPending || redirecting;

  const submit = () => {
    setTouched(true);
    if (!user || !valid || busy) return;
    impersonate.mutate({ targetUserId: user.id, reason: trimmed });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`View as ${name}`}
      subtitle="Open the app exactly as this person sees it."
      size="md"
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button leftIcon="solar:eye-bold" loading={busy} disabled={!valid} onClick={submit}>
            Start viewing
          </Button>
        </>
      }
    >
      {user ? (
        <div className="space-y-5">
          {/* Who you are about to become */}
          <section className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost">
            <Avatar name={name} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold text-ink">{name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge>
                <span className="truncate text-sm text-ink-soft">{user.schoolName ?? user.schoolCode}</span>
              </div>
              {user.email ? <p className="mt-1 truncate text-xs text-muted">{user.email}</p> : null}
            </div>
          </section>

          {/* Reason */}
          <Field label="Reason" required htmlFor={reasonId}>
            <Textarea
              rows={4}
              data-autofocus
              value={reason}
              maxLength={REASON_MAX}
              placeholder="For example: the parent reports that the fees page shows the wrong balance."
              invalid={showReasonError}
              aria-describedby={`${reasonId}-help`}
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => setTouched(true)}
              disabled={busy}
            />
            <div id={`${reasonId}-help`} className="flex items-start justify-between gap-3 text-xs">
              {showReasonError ? (
                <p role="alert" className="flex items-start gap-1.5 font-medium text-danger">
                  <Icon icon="solar:danger-circle-linear" width={14} className="mt-px shrink-0" />
                  <span>
                    Write at least {REASON_MIN} characters ({Math.max(0, REASON_MIN - trimmed.length)} more) so the audit log makes sense.
                  </span>
                </p>
              ) : (
                <p className="text-muted">Saved to the audit log with your name and the time.</p>
              )}
              <span className={cn("ml-auto shrink-0 tabular-nums", reason.length >= REASON_MAX ? "text-danger" : "text-muted")}>
                {reason.length}/{REASON_MAX}
              </span>
            </div>
          </Field>

          {/* The rules of the road */}
          <div role="note" className="flex gap-3 rounded-2xl bg-accent-tint p-4">
            <Icon icon="solar:eye-bold" width={22} className="mt-0.5 shrink-0 text-accent-ink" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-ink">Everything you do is recorded. Sensitive actions are blocked.</p>
              <p className="mt-1 leading-relaxed text-ink-soft">
                The view ends by itself after 60 minutes, or as soon as you press Exit in the banner at the top.
              </p>
            </div>
          </div>

          {/* Server error, shown as the server wrote it */}
          {impersonate.isError ? (
            <div role="alert" className="flex gap-3 rounded-2xl bg-danger-tint p-4">
              <Icon icon="solar:danger-triangle-linear" width={22} className="mt-0.5 shrink-0 text-danger" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-danger">{errorTitle(impersonate.error)}</p>
                <p className="mt-1 leading-relaxed text-ink-soft">{errorMessage(impersonate.error)}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
