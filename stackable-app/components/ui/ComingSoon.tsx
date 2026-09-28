/**
 * ComingSoon - interim placeholder for a page that is planned but not built.
 *
 *   export default function Page() {
 *     return <ComingSoon title="Exams" description="Schedule and grade exams." />;
 *   }
 *
 * Built on EmptyState inside a card. Safe to render from a SERVER component
 * page: no hooks, only serializable props (Icon is its own client boundary).
 */
import { cn } from "@/lib/cn";
import { Badge } from "./Badge";
import { EmptyState } from "./EmptyState";

export interface ComingSoonProps {
  title: string;
  description?: string;
  /** Iconify name; defaults to a Solar hourglass. */
  icon?: string;
  className?: string;
}

const DEFAULT_DESCRIPTION =
  "This page is being built. We are putting the finishing touches on it and it will be ready soon.";

export function ComingSoon({ title, description, icon, className }: ComingSoonProps) {
  return (
    <div className={cn("rounded-2xl bg-surface shadow-soft ring-1 ring-ghost", className)}>
      <EmptyState
        className="py-20"
        icon={icon ?? "solar:hourglass-linear"}
        eyebrow={
          <Badge tone="gold" dot size="sm">
            Coming soon
          </Badge>
        }
        title={title}
        description={description ?? DEFAULT_DESCRIPTION}
      />
    </div>
  );
}

export default ComingSoon;
