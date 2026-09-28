"use client";

// "Attendance today": a progress ring of the rate + present / late / absent
// counts. The source note says which table the numbers came from.

import type { CSSProperties } from "react";
import { AnimatedNumber, Icon } from "@/components/ui";
import { RingChart, useChartTheme } from "@/components/ui/Chart";
import type { AdminOverviewData } from "@/lib/repositories/portal-types";
import { cn } from "@/lib/cn";
import { LiveDot, Panel, PanelEmpty } from "./Panel";

const SOURCE_NOTE: Record<AdminOverviewData["attendanceToday"]["source"], string> = {
  attendance: "From student attendance records",
  class_attendance: "From class registers",
  none: "",
};

function CountTile({
  icon,
  label,
  value,
  bg,
  ink,
}: {
  icon: string;
  label: string;
  value: number;
  bg: string;
  ink: string;
}) {
  return (
    <div className={cn("rounded-xl px-3 py-2.5", bg)}>
      <p className={cn("flex items-center gap-1.5 text-xs font-semibold", ink)}>
        <Icon icon={icon} width={14} />
        {label}
      </p>
      <p className="mt-0.5 font-display text-xl font-semibold text-ink">
        <AnimatedNumber value={value} />
      </p>
    </div>
  );
}

export function AttendanceToday({
  attendance,
  className,
  style,
}: {
  attendance: AdminOverviewData["attendanceToday"];
  className?: string;
  style?: CSSProperties;
}) {
  const theme = useChartTheme();
  const recorded = attendance.source !== "none" && attendance.total > 0;
  const rate = attendance.rate ?? 0;
  // Same thresholds as the rest of the app: 90+ good, 75+ watch, below concerning.
  const ringColor = rate >= 90 ? theme.success : rate >= 75 ? theme.warning : theme.danger;

  return (
    <Panel
      title="Attendance today"
      description={recorded ? SOURCE_NOTE[attendance.source] : undefined}
      className={className}
      style={style}
      action={
        recorded ? (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-ink-soft">
            <LiveDot />
            Live
          </span>
        ) : undefined
      }
    >
      {recorded ? (
        <div className="flex flex-col gap-4">
          <RingChart value={attendance.rate} label="Attendance" color={ringColor} height={170} />
          <div className="grid grid-cols-3 gap-2.5">
            <CountTile icon="solar:user-check-rounded-linear" label="Present" value={attendance.present} bg="bg-success-tint" ink="text-success" />
            <CountTile icon="solar:clock-square-linear" label="Late" value={attendance.late} bg="bg-warning-tint" ink="text-warning" />
            <CountTile icon="solar:user-cross-rounded-linear" label="Absent" value={attendance.absent} bg="bg-danger-tint" ink="text-danger" />
          </div>
        </div>
      ) : (
        <PanelEmpty icon="solar:clipboard-check-linear">No attendance recorded today</PanelEmpty>
      )}
    </Panel>
  );
}
