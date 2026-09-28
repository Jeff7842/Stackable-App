/**
 * PageHeader - title block at the top of every dashboard page.
 *
 *   <PageHeader
 *     title="Students"
 *     subtitle="Everyone enrolled at your school."
 *     breadcrumbs={<span>Dashboard / Students</span>}
 *     actions={<Button leftIcon="solar:add-circle-linear">Add student</Button>}
 *   />
 *
 * No background and no gradient on purpose: the dashboard shell paints the one
 * barely-visible canvas glow behind it. Actions sit right on wide screens and
 * wrap under the title on phones. Server-component safe (no hooks).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-up",
        className,
      )}
    >
      <div className="min-w-0">
        {breadcrumbs ? <div className="mb-2 text-xs font-medium text-muted">{breadcrumbs}</div> : null}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
