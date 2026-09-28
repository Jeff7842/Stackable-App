// A titled block inside a drawer: a surface card on the canvas (tone shift and a
// ghost ring, no divider lines). Server-component safe.

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SectionProps {
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Section({ title, description, className, children }: SectionProps) {
  return (
    <section className={cn("rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost", className)}>
      {title || description ? (
        <header className="mb-4">
          {title ? <h3 className="font-display text-base font-semibold text-ink">{title}</h3> : null}
          {description ? <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export default Section;
