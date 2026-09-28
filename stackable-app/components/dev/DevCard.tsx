/**
 * DevCard - a calm content card: rounded-2xl surface, soft shadow, optional
 * heading row. Sections use <h2> (the Navbar owns the page <h1>).
 * Server-component safe.
 */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function DevCard({
  title,
  description,
  action,
  className,
  style,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <section style={style} className={cn("rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost animate-fade-up", className)}>
      {title || action ? (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-ink-soft">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
