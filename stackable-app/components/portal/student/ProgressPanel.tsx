"use client";

// "Progress at a glance": grades on the left, attendance on the right.
//   - Grades: a progress ring ONLY when a real average score exists; with letters-only
//     data (today's reality) a donut of how the reports split by band, with the overall
//     letter in the middle.
//   - Attendance: ring + present / late / absent, or "No attendance recorded yet".
// Nothing here turns a missing number into 0.

import type { CSSProperties, ReactNode } from "react";
import { RingChart, useChartTheme } from "@/components/ui/Chart";
import type { AttendanceSummary } from "@/lib/repositories/portal-types";
import { pctBand, type GradeMix, type GradeSummary } from "./helpers";
import { AttendanceBlock, GradeBadge, GradeMixBlock } from "./parts";
import { Panel } from "./Panel";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-recessed/60 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{title}</h3>
      {children}
    </div>
  );
}

export function ProgressPanel({
  summary,
  mix,
  attendance,
  description = "Where you stand right now.",
  className,
  style,
}: {
  summary: GradeSummary;
  mix: GradeMix;
  attendance: AttendanceSummary;
  description?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const theme = useChartTheme();
  const band = pctBand(summary.averagePct);
  const ringColor = band === "top" ? theme.success : band === "fair" ? theme.info : theme.danger;

  return (
    <Panel title="Progress at a glance" description={description} className={className} style={style}>
      <div className="grid gap-4 md:grid-cols-2">
        <Block title="Grades">
          {summary.averagePct != null ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-full max-w-[10rem]">
                <RingChart value={summary.averagePct} label="Average" color={ringColor} height={150} />
              </div>
              {summary.overall ? (
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                  Overall grade <GradeBadge grade={summary.overall} />
                </p>
              ) : null}
            </div>
          ) : (
            <GradeMixBlock mix={mix} overall={summary.overall} height={150} />
          )}
        </Block>
        <Block title="Attendance">
          <AttendanceBlock attendance={attendance} />
        </Block>
      </div>
    </Panel>
  );
}
