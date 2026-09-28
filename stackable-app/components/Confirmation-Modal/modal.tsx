"use client";

// Shared confirmation dialog (used through ConfirmationProvider and directly by a
// few pages). Props and behaviour are unchanged; only the look moved to the
// dashboard design tokens so it follows light and dark mode.

import { useId } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";

export type ConfirmationTone = "primary" | "danger" | "success" | "warning";
export type ConfirmationVariant = "confirm" | "success";

export type ConfirmationModalProps = {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: ConfirmationTone;
  variant?: ConfirmationVariant;
  hideCancel?: boolean;
};

// icon = disc colours, ring = soft halo, button = which ui Button variant confirms.
const toneStyles: Record<ConfirmationTone, { icon: string; iconRing: string; button: ButtonVariant }> = {
  primary: { icon: "bg-primary-tint text-primary-ink", iconRing: "ring-primary-tint/50", button: "primary" },
  danger: { icon: "bg-danger-tint text-danger", iconRing: "ring-danger-tint/50", button: "danger" },
  success: { icon: "bg-success-tint text-success", iconRing: "ring-success-tint/50", button: "primary" },
  warning: { icon: "bg-warning-tint text-warning", iconRing: "ring-warning-tint/50", button: "accent" },
};

function Icon({
  variant,
  tone,
}: {
  variant: ConfirmationVariant;
  tone: ConfirmationTone;
}) {
  if (variant === "success") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    );
  }

  if (tone === "danger") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export default function ConfirmationModal({
  open,
  title,
  message,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  tone = "primary",
  variant = "confirm",
  hideCancel = false,
}: ConfirmationModalProps) {
  const titleId = useId();
  const messageId = useId();

  if (!open) {
    return null;
  }

  const selectedTone = variant === "success" ? "success" : tone;
  const styles = toneStyles[selectedTone];

  return (
    // z-[140] keeps it above drawers (z-90/95) and below nothing else.
    <div className="ui-portal fixed inset-0 z-[140] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal overlay"
        tabIndex={-1}
        onClick={loading ? undefined : onClose}
        className="absolute inset-0 animate-fade-in bg-ink/30 backdrop-blur-sm dark:bg-black/60"
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="relative w-full max-w-md animate-fade-up overflow-hidden rounded-2xl bg-surface shadow-pop ring-1 ring-ghost motion-reduce:animate-none"
      >
        <div className="px-6 pb-6 pt-8 text-center sm:px-7">
          <div className="flex justify-center">
            <div className={`flex size-16 items-center justify-center rounded-full ring-8 ${styles.icon} ${styles.iconRing}`}>
              <Icon variant={variant} tone={selectedTone} />
            </div>
          </div>

          <div className="mt-5">
            <h3 id={titleId} className="font-display text-xl font-semibold text-ink">
              {title}
            </h3>
            <p id={messageId} className="mt-2 text-sm leading-6 text-ink-soft">
              {message}
            </p>
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
            {!hideCancel && (
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={loading}
                // Safe default focus: the non-destructive choice.
                autoFocus
                className="min-w-[140px]"
              >
                {cancelLabel}
              </Button>
            )}

            <Button
              variant={styles.button}
              onClick={onConfirm ?? onClose}
              disabled={loading}
              autoFocus={hideCancel}
              className="min-w-[140px]"
            >
              {loading ? "Please wait..." : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
