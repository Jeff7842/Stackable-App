"use client";

// "Class performance": a horizontal bar chart of the average score for the top
// classes, next to a compact table of EVERY class (student count, average,
// grade chip). Chart and table read the same array; classes with no score yet
// are listed in the table but left out of the chart.

import type { CSSProperties } from "react";
import { Badge } from "@/components/ui";
import { BarChart } from "@/components/ui/Chart";
import type { AdminClassPerformance } from "@/lib/repositories/portal-types";
import { cn } from "@/lib/cn";
import { formatPct, gradeTone, scoreBar } from "./helpers";
import { Panel, PanelEmpty } from "./Panel";

const CHART_LIMIT = 8;
const ROW_PX = 40;

function byScoreDesc(a: AdminClassPerformance, b: AdminClassPerformance): number {
  // Classes without a score sink to the bottom; ties fall back to the name.
  const sa = a.averageScore ?? -1;
  const sb = b.averageScore ?? -1;
  return sb - sa || a.className.localeCompare(b.className);
}

export function ClassPerformance({
  classes,
  className,
  style,
}: {
  classes: AdminClassPerformance[];
  className?: string;
  style?: CSSProperties;
}) {
  const sorted = [...classes].sort(byScoreDesc);
  const scored = sorted.filter((c) => c.averageScore != null).slice(0, CHART_LIMIT);

  return (
    <Panel
      title="Class performance"
      description={classes.length > 0 ? "Average score per class." : undefined}
      className={className}
      style={style}
    >
      {classes.length === 0 ? (
        <PanelEmpty icon="solar:widget-2-linear">No classes to report on yet</PanelEmpty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            {scored.length > 0 ? (
              <BarChart
                horizontal
                categories={scored.map((c) => c.className)}
                series={[{ name: "Average score (%)", data: scored.map((c) => Math.round((c.averageScore ?? 0) * 10) / 10) }]}
                yMax={100}
                height={Math.max(200, scored.length * ROW_PX + 48)}
              />
            ) : (
              <PanelEmpty icon="solar:chart-square-linear">No scores recorded yet</PanelEmpty>
            )}
          </div>

          <div className="max-h-[22rem] min-w-0 overflow-auto rounded-xl">
            <table className="w-full min-w-[20rem] text-sm">
              <caption className="sr-only">Every class with its student count and average score</caption>
              <thead>
                <tr>
                  {["Class", "Students", "Average", "Grade"].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={cn(
                        "sticky top-0 bg-recessed px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap text-muted first:rounded-l-xl last:rounded-r-xl",
                        i === 1 ? "text-right" : "text-left",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c.classId} className="odd:bg-surface even:bg-recessed/50">
                    <td className="px-3 py-2.5 font-semibold text-ink">{c.className}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{c.studentCount}</td>
                    <td className="px-3 py-2.5">
                      {c.averageScore == null ? (
                        <span className="text-muted">-</span>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <span className="w-11 font-medium tabular-nums text-ink-soft">{formatPct(c.averageScore, 1)}</span>
                          <div aria-hidden="true" className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-field sm:block">
                            <div
                              className={cn("h-full rounded-full", scoreBar(c.averageScore))}
                              style={{ width: `${Math.max(0, Math.min(100, c.averageScore))}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {c.averageGrade ? (
                        <Badge tone={gradeTone(c.averageScore)} size="sm">
                          {c.averageGrade}
                        </Badge>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}
