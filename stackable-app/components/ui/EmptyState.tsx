/**
 * EmptyState - friendly "nothing here" block (tables, lists, first-run).
 *
 *   <EmptyState
 *     icon="solar:users-group-rounded-linear"
 *     title="No students yet"
 *     description="Add your first student to get started."
 *     action={<Button leftIcon="solar:add-circle-linear">Add student</Button>}
 *   />
 *
 * `eyebrow` (optional) renders above the title - ComingSoon uses it for its
 * badge. Server-component safe (no hooks).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export interface EmptyStateProps {
  /** Iconify name; defaults to a Solar inbox. */
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon = "solar:inbox-linear",
  title,
  description,
  action,
  eyebrow,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-in",
        className,
      )}
    >
      <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-primary-tint text-primary-ink">
        <Icon icon={icon} width={30} />
      </div>
      {eyebrow ? <div className="mb-3">{eyebrow}</div> : null}
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
