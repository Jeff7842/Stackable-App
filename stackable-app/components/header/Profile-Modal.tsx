"use client";

// =============================================================================
// ProfileModal - "who am I signed in as" card, opened from the top-bar menu.
// -----------------------------------------------------------------------------
// Data: useMe() (name, role, school, email). Loading -> skeletons; failure ->
// a short message with a Retry button (never crashes the shell).
// Behaviour: Esc and backdrop click close it, focus is moved inside and kept
// there (Tab wraps), and focus returns to the previous element on close.
// It is rendered OUTSIDE the sticky header (see dashboard-navbar.tsx) because
// the header's backdrop blur would otherwise become its positioning box.
// =============================================================================

import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { useMe } from "@/hooks/useMe";
import { PORTAL_LABEL, settingsHref } from "@/lib/nav";
import type { Portal } from "@/lib/validation/shared";
import { PORTAL_CHIP, displayName, formatRole } from "@/components/dashboard/format";
import { useLogout } from "@/components/dashboard/useLogout";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  portal: Portal;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

const ProfileModal = ({ open, onClose, portal }: ProfileModalProps) => {
  const me = useMe();
  const { logout, pending: loggingOut } = useLogout();
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Focus in, Esc to close, Tab wraps inside the card, focus restored on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = cardRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  const name = displayName(me.data);
  const role = formatRole(me.data?.role, portal);
  const settings = settingsHref(portal);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your profile"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "fixed inset-0 z-[110] flex items-end justify-center p-4 transition-[visibility] duration-300 sm:items-center",
        open ? "visible" : "pointer-events-none invisible",
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close profile"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-ink/40 backdrop-blur-[2px] transition-opacity duration-300 ease-standard dark:bg-canvas/70",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        ref={cardRef}
        className={cn(
          "relative w-full max-w-sm overflow-hidden rounded-2xl bg-surface shadow-pop ring-1 ring-ghost",
          "transition-[opacity,translate,scale] duration-300 ease-standard",
          open ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-95 opacity-0",
        )}
      >
        {/* Tone block instead of a photo cover: light and dark both work. */}
        <div className="h-24 bg-primary-tint" />
        <Button
          ref={closeRef}
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onClose}
          aria-label="Close profile"
          leftIcon="solar:close-circle-linear"
          className="absolute right-3 top-3"
        />

        <div className="px-6 pb-6">
          <div className="-mt-10 flex items-end justify-between">
            {me.isPending ? (
              <Skeleton className="size-20 ring-4 ring-surface" rounded="full" />
            ) : (
              <Avatar name={name} size="xl" status="online" className="rounded-full ring-4 ring-surface" />
            )}
          </div>

          {me.isPending ? (
            <div className="mt-4 space-y-2" aria-busy="true">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-24" rounded="full" />
              <Skeleton className="mt-4 h-24 w-full" rounded="xl" />
            </div>
          ) : me.isError ? (
            <div className="mt-4">
              <h2 className="font-display text-xl font-bold text-ink">
                Your profile
              </h2>
              <p className="mt-2 text-sm text-danger">We could not load your details right now.</p>
              <div className="mt-4">
                <Button variant="secondary" size="sm" leftIcon="solar:restart-linear" onClick={() => void me.refetch()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="mt-4 truncate font-display text-xl font-bold text-ink">
                {name}
              </h2>
              <span
                className={cn(
                  "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                  PORTAL_CHIP[portal],
                )}
              >
                {role}
              </span>

              <dl className="mt-5 space-y-3 rounded-xl bg-recessed p-4">
                <Row label="School" value={me.data?.schoolName ?? PORTAL_LABEL[portal]} />
                <Row label="School code" value={me.data?.schoolCode} />
                <Row label="Email" value={me.data?.email} />
              </dl>
            </>
          )}

          <div className="mt-5 flex gap-3">
            {settings ? (
              <Button as="a" href={settings} variant="secondary" fullWidth onClick={onClose}>
                Settings
              </Button>
            ) : null}
            <Button variant="danger" fullWidth loading={loggingOut} leftIcon="solar:logout-2-linear" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
