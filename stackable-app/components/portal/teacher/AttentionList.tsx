"use client";

// "Students needing attention": lowest averages first (the API already orders
// them). The View button deep-links into the students page with the profile
// drawer open: /teach/students?student=<id>.

import type { CSSProperties } from "react";
import { Avatar, Badge, Button } from "@/components/ui";
import type { TeacherAttentionItem } from "@/lib/repositories/portal-types";
import { formatPct } from "./helpers";
import { Panel, PanelEmpty, stagger } from "./Panel";

function reasonChip(reason: TeacherAttentionItem["reason"]) {
  return reason === "low-average" ? (
    <Badge tone="warning" size="sm">
      Low average
    </Badge>
  ) : (
    <Badge tone="neutral" size="sm">
      No grades yet
    </Badge>
  );
}

export function AttentionList({
  items,
  className,
  style,
}: {
  items: TeacherAttentionItem[];
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Panel
      title="Students needing attention"
      description={items.length > 0 ? "Low averages and students with no grades yet." : undefined}
      className={className}
      style={style}
    >
      {items.length === 0 ? (
        <PanelEmpty icon="solar:smile-circle-linear">
          Everyone is on track. Students with low averages or no grades will show up here.
        </PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={item.studentId}
              style={stagger(i, 50)}
              className="flex animate-fade-up items-center gap-3 rounded-xl bg-recessed/60 p-3"
            >
              <Avatar name={item.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {item.className ?? "No class"}
                  {item.averagePct != null ? ` · Avg ${formatPct(item.averagePct)}` : ""}
                </p>
                <div className="mt-1.5">{reasonChip(item.reason)}</div>
              </div>
              <Button
                as="a"
                href={`/teach/students?student=${encodeURIComponent(item.studentId)}`}
                variant="secondary"
                size="sm"
                rightIcon="solar:arrow-right-linear"
                aria-label={`Open ${item.name}'s profile`}
              >
                View
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
