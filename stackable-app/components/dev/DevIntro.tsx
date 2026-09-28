/**
 * DevIntro - the one-line description + actions under the page title.
 *
 * Why not PageHeader: the dashboard Navbar already renders the page title as the
 * document's <h1>, and PageHeader always renders another <h1>. This block has the
 * same layout (fade-up, actions on the right on wide screens) but no heading, so
 * each dev page keeps exactly one <h1>. Server-component safe.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function DevIntro({
  subtitle,
  actions,
  className,
}: {
  subtitle: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-fade-up", className)}>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">{subtitle}</p>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}
