"use client";

// SitemapView - every page that exists, for every portal (admin, developer,
// teacher, student, parent), in one place. Pulled straight from lib/nav.ts - the
// same config that drives every sidebar - so a page listed here always exists,
// and a page added to a sidebar always shows up here with no extra work.
//
// Portal pages enforce their own role via requireRole() in each role layout, so a
// super-admin opening one directly is redirected to their own home unless they are
// viewing as a user of that role - hence the "Impersonate" nudge for non-developer
// portals instead of a plain link.
import Link from "next/link";
import { Icon } from "@iconify-icon/react";
import { flattenNav, PORTAL_LABEL, PORTAL_HOME } from "@/lib/nav";
import type { Portal } from "@/lib/validation/shared";
import { DevCard } from "./DevCard";
import { DevIntro } from "./DevIntro";

const PORTAL_ORDER: Portal[] = ["developer", "dashboard", "principal", "teacher", "student", "parent"];

// A small accent per portal so the eye can jump straight to one section.
const PORTAL_ACCENT: Record<Portal, string> = {
  developer: "bg-primary-tint text-primary",
  dashboard: "bg-accent-tint text-accent-foreground",
  principal: "bg-accent-tint text-accent-foreground",
  teacher: "bg-info-tint text-info",
  student: "bg-success-tint text-success",
  parent: "bg-warning-tint text-warning",
};

const PORTAL_ICON: Record<Portal, string> = {
  developer: "solar:code-square-linear",
  dashboard: "solar:buildings-2-linear",
  principal: "solar:buildings-2-linear",
  teacher: "solar:users-group-two-rounded-linear",
  student: "solar:square-academic-cap-linear",
  parent: "solar:user-hands-linear",
};

function PortalSection({ portal }: { portal: Portal }) {
  const entries = flattenNav(portal);
  // Group by section label, preserving the order lib/nav.ts already defines.
  const bySection = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = bySection.get(entry.section) ?? [];
    list.push(entry);
    bySection.set(entry.section, list);
  }
  const isDeveloper = portal === "developer";

  return (
    <DevCard
      title={
        <span className="inline-flex items-center gap-2">
          <span className={`inline-flex size-7 items-center justify-center rounded-lg ${PORTAL_ACCENT[portal]}`}>
            <Icon icon={PORTAL_ICON[portal]} width="16" height="16" />
          </span>
          {PORTAL_LABEL[portal]}
        </span>
      }
      description={`${entries.length} page${entries.length === 1 ? "" : "s"} · lands on ${PORTAL_HOME[portal]}`}
    >
      <div className="space-y-4">
        {[...bySection.entries()].map(([section, rows]) => (
          <div key={section}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">{section}</p>
            <ul className="space-y-0.5">
              {rows.map((row) => (
                <li key={row.href}>
                  <Link
                    href={row.href}
                    className="group flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-sm text-ink transition-colors duration-200 hover:bg-field"
                    title={
                      isDeveloper
                        ? undefined
                        : "Opens directly for a developer; other roles need you to be viewing as that role first (Users → Impersonate)."
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon
                        icon={`solar:${typeof row.icon === "string" ? row.icon : "file-text"}-linear`}
                        width="15"
                        height="15"
                        className="shrink-0 text-muted"
                      />
                      <span className="truncate">
                        {row.group ? <span className="text-muted">{row.group} / </span> : null}
                        {row.label}
                      </span>
                    </span>
                    <code className="shrink-0 truncate font-mono text-[11px] text-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      {row.href}
                    </code>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </DevCard>
  );
}

export function SitemapView() {
  const totalPages = PORTAL_ORDER.reduce((sum, portal) => sum + flattenNav(portal).length, 0);

  return (
    <div className="space-y-6">
      <DevIntro
        subtitle={`Every page across every portal - ${totalPages} in total - kept in sync automatically with each sidebar (lib/nav.ts). Use this to jump anywhere, or to check nothing is missing before a demo.`}
        actions={
          <Link
            href="/dev/users"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Icon icon="solar:eye-linear" width="16" height="16" />
            View as a user
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {PORTAL_ORDER.map((portal) => (
          <PortalSection key={portal} portal={portal} />
        ))}
      </div>
    </div>
  );
}
