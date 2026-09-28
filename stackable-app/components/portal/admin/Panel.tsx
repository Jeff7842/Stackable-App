// =============================================================================
// Panel primitives for the admin overview (card + header + empty + error block).
// Tokens only. No divider lines: a card is a tone shift (surface on canvas) with
// a soft shadow and a ghost ring, exactly like StatCard.
// (Intentionally a local copy: lanes do not share components this wave.)
// =============================================================================

import type { CSSProperties, ReactNode } from "react";
import { Button, Icon } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Inline animation-delay for `animate-fade-up` so siblings appear one after another. */
export function stagger(index: number, step = 60): CSSProperties {
  return { animationDelay: `${Math.min(index, 10) * step}ms` };
}

/** Small pulsing status dot ("live"). Static under reduced motion (global rule). */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-2 shrink-0", className)}>
      <span className="absolute inset-0 animate-pulse-dot rounded-full bg-primary" />
      <span className="relative size-2 rounded-full bg-primary" />
    </span>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  style,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      aria-label={title}
      style={style}
      className={cn("animate-fade-up rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost", className)}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Quiet empty message inside a Panel (a recessed block, no border). */
export function PanelEmpty({
  icon,
  children,
  action,
  className,
}: {
  icon: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-xl bg-recessed/60 px-4 py-8 text-center", className)}>
      <span className="grid size-11 place-items-center rounded-full bg-primary-tint text-primary-ink">
        <Icon icon={icon} width={22} />
      </span>
      <p className="max-w-xs text-sm leading-relaxed text-ink-soft">{children}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** Page-level error: server message + Retry. `role="alert"` so it is announced. */
export function QueryError({
  title,
  message,
  onRetry,
  retrying,
}: {
  title: string;
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex animate-fade-in flex-col items-center rounded-2xl bg-surface px-6 py-14 text-center shadow-soft ring-1 ring-ghost"
    >
      <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-danger-tint text-danger">
        <Icon icon="solar:danger-triangle-linear" width={30} />
      </div>
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">{message}</p>
      <Button className="mt-6" leftIcon="solar:restart-linear" onClick={onRetry} loading={retrying}>
        Retry
      </Button>
    </div>
  );
}
