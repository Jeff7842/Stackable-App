"use client";

// Quick actions: four Button links. These routes exist today as placeholder
// pages, so the buttons are safe to ship. Gold ("accent") is used once, on the
// action a teacher reaches for first.

import type { CSSProperties } from "react";
import { Button } from "@/components/ui";
import { Panel, stagger } from "./Panel";

const ACTIONS = [
  { href: "/teach/attendance", label: "Attendance", icon: "solar:clipboard-check-linear", variant: "accent" },
  { href: "/teach/grading", label: "Grading", icon: "solar:pen-new-square-linear", variant: "secondary" },
  { href: "/teach/timetable", label: "Timetable", icon: "solar:clock-circle-linear", variant: "secondary" },
  { href: "/teach/inbox", label: "Inbox", icon: "solar:inbox-linear", variant: "secondary" },
] as const;

export function QuickActions({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <Panel title="Quick actions" className={className} style={style}>
      <div className="grid grid-cols-2 gap-2.5">
        {ACTIONS.map((action, i) => (
          <div key={action.href} style={stagger(i, 50)} className="animate-fade-up">
            <Button as="a" href={action.href} variant={action.variant} leftIcon={action.icon} fullWidth>
              {action.label}
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
