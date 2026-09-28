"use client";

// "Recent grading": the last reports this teacher wrote, newest first.

import type { CSSProperties } from "react";
import { Badge, Button } from "@/components/ui";
import type { TeacherGradeEntry } from "@/lib/repositories/portal-types";
import { formatPct, gradeTone, timeAgo } from "./helpers";
import { Panel, PanelEmpty, stagger } from "./Panel";

export function RecentGrading({
  entries,
  epochMinute,
  className,
  style,
}: {
  entries: TeacherGradeEntry[];
  /** From useEpochMinute(); drives the relative "5m ago" labels. */
  epochMinute: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Panel
      title="Recent grading"
      description={entries.length > 0 ? "The latest reports you have written." : undefined}
      className={className}
      style={style}
    >
      {entries.length === 0 ? (
        <PanelEmpty
          icon="solar:pen-new-square-linear"
          action={
            <Button as="a" href="/teach/grading" size="sm" variant="secondary" leftIcon="solar:pen-new-square-linear">
              Start grading
            </Button>
          }
        >
          No grades recorded yet. Reports you write will appear here.
        </PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry, i) => (
            <li
              key={entry.id}
              style={stagger(i, 50)}
              className="flex animate-fade-up items-center gap-3 rounded-xl bg-recessed/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{entry.studentName}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {entry.subject} · {entry.term}
                  {entry.className ? ` · ${entry.className}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone={gradeTone(entry.normalizedPct)} size="sm">
                  {entry.grade}
                  {entry.normalizedPct != null ? ` · ${formatPct(entry.normalizedPct)}` : ""}
                </Badge>
                <span className="text-[11px] text-muted">{timeAgo(entry.createdAt, epochMinute)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
