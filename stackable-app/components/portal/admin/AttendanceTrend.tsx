"use client";

// "Attendance last 7 days": one solid-fill area line of the daily rate.
// The y-axis starts a little below the lowest day so small swings stay readable
// (the axis labels always show the real scale).

import type { CSSProperties } from "react";
import { Badge } from "@/components/ui";
import { AreaChart } from "@/components/ui/Chart";
import type { AdminAttendanceDay } from "@/lib/repositories/portal-types";
import { formatPct, trendLabel } from "./helpers";
import { Panel, PanelEmpty } from "./Panel";

export function AttendanceTrend({
  days,
  className,
  style,
}: {
  days: AdminAttendanceDay[];
  className?: string;
  style?: CSSProperties;
}) {
  const rates = days.map((d) => d.rate);
  const average = rates.length > 0 ? rates.reduce((sum, r) => sum + r, 0) / rates.length : null;
  const yMin = rates.length > 0 ? Math.max(0, Math.floor((Math.min(...rates) - 10) / 10) * 10) : 0;

  return (
    <Panel
      title="Attendance last 7 days"
      description={days.length > 0 ? "Share of students present (late included) each recorded day." : undefined}
      className={className}
      style={style}
      action={average != null ? <Badge tone="info">Avg {formatPct(average, 1)}</Badge> : undefined}
    >
      {days.length === 0 ? (
        <PanelEmpty icon="solar:chart-square-linear">No attendance history yet</PanelEmpty>
      ) : (
        <AreaChart
          categories={days.map((d) => trendLabel(d.date))}
          series={[{ name: "Attendance rate (%)", data: rates }]}
          yMax={100}
          yMin={yMin}
          height={240}
        />
      )}
    </Panel>
  );
}
