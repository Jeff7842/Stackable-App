"use client";

// RolesCard - "Users by role": donut with the total in the centre, a compact legend
// (dot / role / count / share) and the status split as small pills.
// Colours come from useChartTheme (design tokens read at runtime), so light and dark
// follow the theme toggle. The four largest roles get their own colour; the rest are
// grouped as "Other". Gold appears once (the 4th slice) on purpose.

import { useMemo } from "react";
import { Badge, EmptyState } from "@/components/ui";
import { DonutChart, useChartTheme, type DonutDatum } from "@/components/ui/Chart";
import type { DevOverview } from "@/lib/dev-types";
import { DevCard } from "./DevCard";
import { roleLabel, statusTone, titleCase } from "./format";
import type { CSSProperties } from "react";

const MAX_SLICES = 4;
const STATUS_ORDER = ["active", "pending", "suspended"];

export function RolesCard({ counts, style }: { counts: DevOverview["counts"]; style?: CSSProperties }) {
  const theme = useChartTheme();

  const slices = useMemo<DonutDatum[]>(() => {
    const roles = Object.entries(counts.usersByRole)
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]);
    const colours = [theme.primary, theme.info, theme.warning, theme.accent];
    const top: DonutDatum[] = roles.slice(0, MAX_SLICES).map(([role, value], index) => ({
      label: roleLabel(role),
      value,
      color: colours[index],
    }));
    const rest = roles.slice(MAX_SLICES).reduce((sum, [, value]) => sum + value, 0);
    return rest > 0 ? [...top, { label: "Other", value: rest, color: theme.muted }] : top;
  }, [counts.usersByRole, theme]);

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  const statuses = useMemo(() => {
    const known = STATUS_ORDER.filter((status) => counts.usersByStatus[status] !== undefined);
    const extra = Object.keys(counts.usersByStatus).filter((status) => !STATUS_ORDER.includes(status));
    return [...known, ...extra].map((status) => ({ status, value: counts.usersByStatus[status] }));
  }, [counts.usersByStatus]);

  return (
    <DevCard title="Users by role" description={`${total.toLocaleString("en-US")} accounts across all schools`} style={style}>
      {total === 0 ? (
        <EmptyState icon="solar:users-group-two-rounded-linear" title="No users yet" description="Accounts will appear here once schools add people." className="py-8" />
      ) : (
        <>
          <DonutChart data={slices} centerValue={total.toLocaleString("en-US")} centerLabel="Users" height={200} />

          <ul className="mt-4 space-y-1.5">
            {slices.map((slice) => (
              <li key={slice.label} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors duration-300 ease-standard hover:bg-recessed">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="min-w-0 flex-1 truncate text-ink-soft">{slice.label}</span>
                <span className="font-semibold text-ink tabular-nums">{slice.value.toLocaleString("en-US")}</span>
                <span className="w-10 text-right text-xs text-muted tabular-nums">{Math.round((slice.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>

          {statuses.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Users by status">
              {statuses.map(({ status, value }) => (
                <Badge key={status} tone={statusTone(status)} dot>
                  {titleCase(status)} <span className="tabular-nums">{value.toLocaleString("en-US")}</span>
                </Badge>
              ))}
            </div>
          ) : null}
        </>
      )}
    </DevCard>
  );
}
