"use client";

// Quick links: only pages that exist in lib/nav.ts (the ones not built yet are
// ComingSoon pages, so a click is always safe). Gold ("accent") is used once.

import type { CSSProperties } from "react";
import { Button } from "@/components/ui";
import { Panel, stagger } from "./Panel";

const LINKS = [
  { href: "/learn/grades", label: "My grades", icon: "solar:chart-square-linear", variant: "accent" },
  { href: "/learn/subjects", label: "Subjects", icon: "solar:book-2-linear", variant: "secondary" },
  { href: "/learn/homework", label: "Homework", icon: "solar:notebook-linear", variant: "secondary" },
  { href: "/learn/library", label: "Library", icon: "solar:library-linear", variant: "secondary" },
] as const;

export function QuickLinks({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <Panel title="Quick links" className={className} style={style}>
      <div className="grid grid-cols-2 gap-2.5">
        {LINKS.map((link, i) => (
          <div key={link.href} style={stagger(i, 50)} className="animate-fade-up">
            <Button as="a" href={link.href} variant={link.variant} leftIcon={link.icon} fullWidth>
              {link.label}
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
