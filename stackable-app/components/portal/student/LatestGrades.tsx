"use client";

// "Latest grades": the newest reports first. The score (%) chip shows only when the
// school recorded one; letters carry the row on their own. `viewAllHref` defaults to the
// student's grades page; the parent portal passes null (it has no such page).

import type { CSSProperties } from "react";
import { Button } from "@/components/ui";
import type { GradeRow } from "@/lib/repositories/portal-types";
import { timeAgo } from "./clock";
import { formatPct } from "./helpers";
import { GradeBadge } from "./parts";
import { Panel, PanelEmpty, stagger } from "./Panel";

export function LatestGrades({
  grades,
  epochMinute,
  viewAllHref = "/learn/grades",
  description = "The newest reports from your teachers.",
  emptyText = "No grades yet. Reports appear here as soon as your teachers record them.",
  className,
  style,
}: {
  /** Already sorted newest first. */
  grades: GradeRow[];
  /** From useEpochMinute(); drives the relative "5m ago" labels. */
  epochMinute: number;
  viewAllHref?: string | null;
  description?: string;
  emptyText?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const rows = grades.slice(0, 5);
  return (
    <Panel
      title="Latest grades"
      description={rows.length > 0 ? description : undefined}
      className={className}
      style={style}
      action={
        rows.length > 0 && viewAllHref ? (
          <Button as="a" href={viewAllHref} variant="ghost" size="sm" rightIcon="solar:arrow-right-linear">
            View all
          </Button>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <PanelEmpty icon="solar:chart-square-linear">{emptyText}</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {rows.map((g, i) => (
            <li
              key={`${g.subject}-${g.term}-${i}`}
              style={stagger(i, 50)}
              className="flex animate-fade-up items-center gap-3 rounded-xl bg-recessed/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{g.subject}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {g.term}
                  {g.createdAt ? ` · ${timeAgo(g.createdAt, epochMinute)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {g.normalizedPct != null ? (
                  <span className="text-xs font-medium tabular-nums text-ink-soft">{formatPct(g.normalizedPct)}</span>
                ) : null}
                <GradeBadge grade={g.grade} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
