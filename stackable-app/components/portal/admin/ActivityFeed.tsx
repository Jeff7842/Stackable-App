"use client";

// Right-rail "Recent activity": merged feed (grades, new students, new
// teachers). One tinted icon tile per kind, then title, detail and relative time.

import type { CSSProperties } from "react";
import { Icon } from "@/components/ui";
import type { AdminActivityItem } from "@/lib/repositories/portal-types";
import { cn } from "@/lib/cn";
import { timeAgo } from "./helpers";
import { Panel, PanelEmpty, stagger } from "./Panel";

const KIND: Record<AdminActivityItem["kind"], { icon: string; bg: string; ink: string; label: string }> = {
  grade: { icon: "solar:chart-square-linear", bg: "bg-info-tint", ink: "text-info", label: "Grade report" },
  student: { icon: "solar:square-academic-cap-linear", bg: "bg-primary-tint", ink: "text-primary-ink", label: "New student" },
  teacher: { icon: "solar:users-group-two-rounded-linear", bg: "bg-accent-tint", ink: "text-accent-ink", label: "New teacher" },
};

export function ActivityFeed({
  items,
  epochMinute,
  className,
  style,
}: {
  items: AdminActivityItem[];
  epochMinute: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Panel
      title="Recent activity"
      description={items.length > 0 ? "What just happened at your school." : undefined}
      className={className}
      style={style}
    >
      {items.length === 0 ? (
        <PanelEmpty icon="solar:history-linear">No recent activity yet</PanelEmpty>
      ) : (
        <ol className="space-y-2">
          {items.map((item, i) => {
            const kind = KIND[item.kind] ?? KIND.grade;
            return (
              <li
                key={item.id}
                style={stagger(i, 50)}
                className="flex animate-fade-up items-start gap-3 rounded-xl bg-recessed/60 p-3"
              >
                <span
                  role="img"
                  aria-label={kind.label}
                  className={cn("grid size-9 shrink-0 place-items-center rounded-full", kind.bg, kind.ink)}
                >
                  <Icon icon={kind.icon} width={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-ink">{item.title}</p>
                  {item.detail ? <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{item.detail}</p> : null}
                </div>
                <span className="shrink-0 pt-0.5 text-[11px] whitespace-nowrap text-muted">
                  {timeAgo(item.at, epochMinute)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
