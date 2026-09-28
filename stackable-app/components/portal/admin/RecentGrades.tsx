"use client";

// "Recent grade reports": latest reports across the school as a tone-shifted
// table. Class and term drop out on phones so the row stays readable.

import type { CSSProperties } from "react";
import { Avatar, Badge, Button } from "@/components/ui";
import type { AdminRecentGrade } from "@/lib/repositories/portal-types";
import { formatPct, gradeTone, timeAgo } from "./helpers";
import { Panel, PanelEmpty } from "./Panel";

export function RecentGrades({
  grades,
  epochMinute,
  className,
  style,
}: {
  grades: AdminRecentGrade[];
  /** From useEpochMinute(); drives the relative "5m ago" labels. */
  epochMinute: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Panel
      title="Recent grade reports"
      description={grades.length > 0 ? "The latest reports written across the school." : undefined}
      className={className}
      style={style}
      action={
        <Button as="a" href="/dashboard/grades-reports" variant="ghost" size="sm" rightIcon="solar:arrow-right-linear">
          View all
        </Button>
      }
    >
      {grades.length === 0 ? (
        <PanelEmpty icon="solar:chart-square-linear">No grade reports yet. New reports will show up here.</PanelEmpty>
      ) : (
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full min-w-[22rem] text-sm">
            <caption className="sr-only">Most recent grade reports</caption>
            <thead>
              <tr>
                <th scope="col" className="bg-recessed px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted first:rounded-l-xl">
                  Student
                </th>
                <th scope="col" className="hidden bg-recessed px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted md:table-cell">
                  Class
                </th>
                <th scope="col" className="bg-recessed px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Subject
                </th>
                <th scope="col" className="hidden bg-recessed px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted md:table-cell">
                  Term
                </th>
                <th scope="col" className="bg-recessed px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Grade
                </th>
                <th scope="col" className="bg-recessed px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted last:rounded-r-xl">
                  When
                </th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g.id} className="odd:bg-surface even:bg-recessed/50">
                  <td className="px-3 py-2.5">
                    <div className="flex min-w-[9rem] items-center gap-2.5">
                      <Avatar name={g.studentName} size="sm" />
                      <span className="font-semibold text-ink">{g.studentName}</span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 whitespace-nowrap text-ink-soft md:table-cell">{g.className ?? "-"}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{g.subject}</td>
                  <td className="hidden px-3 py-2.5 whitespace-nowrap text-ink-soft md:table-cell">{g.term}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={gradeTone(g.normalizedPct)} size="sm">
                      {g.grade}
                      {g.normalizedPct != null ? ` · ${formatPct(g.normalizedPct)}` : ""}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap text-muted">
                    {timeAgo(g.createdAt, epochMinute)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
