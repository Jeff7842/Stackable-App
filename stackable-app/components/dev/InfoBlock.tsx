"use client";

// InfoBlock - one calm label / value tile for detail drawers (see the "User
// details" reference: quiet label above a confident value). Render inside
// <dl className="grid gap-3 sm:grid-cols-2">. `copy` adds a copy button; `wide`
// spans both columns; `mono` uses the mono face (ids, paths, IPs).

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CopyButton } from "./CopyButton";

export function InfoBlock({
  label,
  children,
  mono = false,
  wide = false,
  copy,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  wide?: boolean;
  /** Value to put on the clipboard; shows a copy button when set. */
  copy?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-2 rounded-xl bg-surface p-4 shadow-soft ring-1 ring-ghost", wide && "sm:col-span-2")}>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
        <dd className={cn("mt-1 text-sm font-semibold break-words text-ink", mono && "font-mono text-xs font-medium break-all")}>
          {children}
        </dd>
      </div>
      {copy ? <CopyButton value={copy} label={label.toLowerCase()} /> : null}
    </div>
  );
}
