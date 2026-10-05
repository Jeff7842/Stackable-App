"use client";

// =============================================================================
// Sidebar - the collapsible left menu of every dashboard portal.
// -----------------------------------------------------------------------------
// Data comes from lib/nav.ts (NAV[portal]); the DashboardShell owns the
// collapsed / mobile-open state and passes it in.
//
// ACTIVE-ROUTE RULE (implemented once in lib/nav.ts -> activeNavHref):
//   1. A row matches when pathname === href or pathname starts with href + "/".
//   2. A portal's landing page (/dashboard, /admin, /teach, /learn, /family,
//      /dev) matches ONLY exactly, so "Overview" does not light up everywhere.
//   3. When several rows match, the LONGEST href wins and only that row is
//      active: /dashboard/students/allocation activates "Allocation", not
//      "All students".
//   4. A group is active when one of its children is the active row.
//
// Look: active row = filled `primary-tint` pill + primary text + BOLD Solar
// icon; hover = recessed tone + a 2px nudge; no divider lines anywhere (tone
// shifts and spacing only); 10px tracked section labels.
//
// Modes: desktop (sticky column, expanded or icon-only) and mobile (<lg) where
// the same element becomes a slide-in drawer with a backdrop.
// =============================================================================

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { useMe } from "@/hooks/useMe";
import { PORTAL_HOME, PORTAL_LABEL, activeNavHref, navFor } from "@/lib/nav";
import type { Portal } from "@/lib/validation/shared";
import { useTransitionsReady } from "@/components/dashboard/hooks";
import { useLogout } from "@/components/dashboard/useLogout";
import { PORTAL_CHIP, formatRole } from "@/components/dashboard/format";

// -----------------------------------------------------------------------------
// Types (exported: lib/nav.ts builds its config from these)
// -----------------------------------------------------------------------------
export type SidebarChild = {
  href: string;
  label: string;
  /** Page title when it differs from the row label ("All students" -> "Students"). */
  title?: string;
  /** Page exists but is not built yet; shows a "Soon" tag. */
  soon?: boolean;
};

export type SidebarLeafItem = {
  type: "link";
  href: string;
  /** Solar icon base name ("home-2" -> solar:home-2-linear / -bold) or a ready node. */
  icon: ReactNode | string;
  label: string;
  title?: string;
  /** Kept for backwards compatibility with the old layouts; no visual effect now. */
  variant?: "default" | "top";
  /** Candidate for the mobile bottom pill. */
  primary?: boolean;
  /** Extra words for the quick search. */
  keywords?: string[];
  /** Shows a pulsing "live" status dot. */
  live?: boolean;
  /** Page exists but is not built yet; shows a "Soon" tag. */
  soon?: boolean;
};

export type SidebarGroupItem = {
  type: "group";
  children: SidebarChild[];
  icon: ReactNode | string;
  key: string;
  label: string;
  primary?: boolean;
  keywords?: string[];
  live?: boolean;
  soon?: boolean;
};

export type SidebarItem = SidebarLeafItem | SidebarGroupItem;

export type SidebarSection = {
  ariaLabel: string;
  items: SidebarItem[];
  key: string;
  /** Visible section heading ("People"). Optional. */
  label?: string;
  /** When set, only these roles see the section (used by the shared /staff portal). */
  roles?: readonly string[];
};

type SidebarProps = {
  portal: Portal;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
};

// -----------------------------------------------------------------------------
// Shared bits
// -----------------------------------------------------------------------------
// NB: Tailwind v4 moves translate/scale onto their own CSS properties, so they
// must be listed in the transition (`transition-transform` alone is not enough
// when a custom property list is used).
const ROW =
  "group/row relative flex items-center rounded-xl text-sm outline-none " +
  "transition-[background-color,color,translate,scale] duration-300 ease-standard " +
  "focus-visible:-outline-offset-2 active:scale-[0.98]";
const ROW_OPEN = "w-full gap-3 px-3"; // expanded row geometry
const ROW_ICON_ONLY = "mx-auto size-11 justify-center"; // collapsed row geometry
const ROW_IDLE = "font-medium text-ink-soft hover:bg-recessed hover:text-ink";

export function NavIcon({
  icon,
  active,
  width = 20,
}: {
  icon: ReactNode | string;
  active?: boolean;
  width?: number;
}) {
  if (typeof icon !== "string") return <>{icon}</>;
  return <Icon icon={`solar:${icon}-${active ? "bold" : "linear"}`} width={width} className="shrink-0" />;
}

/** Pulsing green dot = "live" status. */
function LiveDot() {
  return (
    <span aria-hidden="true" className="relative ml-auto inline-flex size-2 shrink-0">
      <span className="absolute inset-0 rounded-full bg-success animate-pulse-dot" />
      <span className="relative size-2 rounded-full bg-success" />
    </span>
  );
}

/** Small tag for pages that are planned but not built. */
function SoonTag() {
  return (
    <span className="ml-auto shrink-0 rounded-full bg-recessed px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
      Soon
    </span>
  );
}

type TipHandlers = {
  onTip: (el: HTMLElement, label: string) => void;
  offTip: () => void;
};

// -----------------------------------------------------------------------------
// Rows
// -----------------------------------------------------------------------------
function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate,
  onTip,
  offTip,
}: {
  item: SidebarLeafItem;
  active: boolean;
  collapsed: boolean;
} & TipHandlers & { onNavigate: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={() => {
        offTip();
        onNavigate();
      }}
      onMouseEnter={(event) => onTip(event.currentTarget, item.label)}
      onFocus={(event) => onTip(event.currentTarget, item.label)}
      onMouseLeave={offTip}
      onBlur={offTip}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        ROW,
        collapsed ? ROW_ICON_ONLY : cn(ROW_OPEN, "h-11 lg:h-10"),
        active
          ? "bg-primary-tint font-semibold text-primary-ink"
          : cn(ROW_IDLE, !collapsed && "hover:translate-x-0.5"),
      )}
    >
      <NavIcon icon={item.icon} active={active} />
      {collapsed ? null : <span className="truncate">{item.label}</span>}
      {item.live && !collapsed ? <LiveDot /> : null}
      {item.soon && !collapsed ? <SoonTag /> : null}
    </Link>
  );
}

function SidebarGroup({
  item,
  open,
  hasActiveChild,
  activeHref,
  collapsed,
  onToggle,
  onOpenFromCollapsed,
  onNavigate,
  onTip,
  offTip,
}: {
  item: SidebarGroupItem;
  open: boolean;
  hasActiveChild: boolean;
  activeHref: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onOpenFromCollapsed: () => void;
  onNavigate: () => void;
} & TipHandlers) {
  const showOpen = open && !collapsed;
  const panelId = `sidebar-group-${item.key}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          offTip();
          if (collapsed) onOpenFromCollapsed();
          else onToggle();
        }}
        onMouseEnter={(event) => onTip(event.currentTarget, item.label)}
        onFocus={(event) => onTip(event.currentTarget, item.label)}
        onMouseLeave={offTip}
        onBlur={offTip}
        aria-expanded={collapsed ? undefined : showOpen}
        aria-controls={collapsed ? undefined : panelId}
        aria-label={collapsed ? item.label : undefined}
        className={cn(
          ROW,
          collapsed ? ROW_ICON_ONLY : cn(ROW_OPEN, "h-11 lg:h-10"),
          hasActiveChild ? "font-semibold text-primary-ink hover:bg-recessed" : cn(ROW_IDLE, !collapsed && "hover:translate-x-0.5"),
        )}
      >
        <NavIcon icon={item.icon} active={hasActiveChild} />
        {collapsed ? null : (
          <>
            <span className="truncate">{item.label}</span>
            {item.live ? <LiveDot /> : null}
            {item.soon ? <SoonTag /> : null}
            <Icon
              icon="solar:alt-arrow-down-linear"
              width={16}
              className={cn(
                "shrink-0 text-muted transition-transform duration-300 ease-standard",
                item.live || item.soon ? "ml-1" : "ml-auto",
                showOpen && "rotate-180",
              )}
            />
          </>
        )}
      </button>

      {collapsed ? null : (
        // Height animates via the 0fr -> 1fr grid-rows trick; `inert` keeps the
        // hidden links out of the tab order while collapsed.
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-standard",
            showOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <ul id={panelId} inert={!showOpen} className="min-h-0 space-y-0.5 overflow-hidden pt-0.5">
            {item.children.map((child) => {
              const active = child.href === activeHref;
              return (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      ROW,
                      "h-10 w-full gap-3 pl-[2.75rem] pr-3 text-[13px] lg:h-9",
                      active
                        ? "bg-primary-tint font-semibold text-primary-ink"
                        : cn(ROW_IDLE, "hover:translate-x-0.5"),
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-[1.35rem] size-1.5 rounded-full transition-colors duration-300 ease-standard",
                        active ? "bg-primary" : "bg-field group-hover/row:bg-muted",
                      )}
                    />
                    <span className="truncate">{child.label}</span>
                    {child.soon ? <SoonTag /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Header block: role chip + school name
// -----------------------------------------------------------------------------
function SchoolBlock({ portal, collapsed }: { portal: Portal; collapsed: boolean }) {
  const me = useMe();
  const schoolName = me.data?.schoolName ?? me.data?.schoolCode ?? null;
  const roleLabel = formatRole(me.data?.role, portal);
  const initial = (schoolName ?? PORTAL_LABEL[portal]).trim().charAt(0).toUpperCase();

  if (collapsed) {
    return (
      <div
        aria-label={schoolName ? `${schoolName}, ${roleLabel}` : roleLabel}
        role="img"
        className={cn(
          "mx-auto flex size-10 items-center justify-center rounded-xl font-display text-sm font-bold",
          PORTAL_CHIP[portal],
        )}
      >
        {me.isPending ? <Skeleton className="size-4" rounded="full" /> : initial}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-recessed p-3" aria-busy={me.isPending || undefined}>
      {me.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" rounded="full" />
          <Skeleton className="h-4 w-32" />
        </div>
      ) : (
        <>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
              PORTAL_CHIP[portal],
            )}
          >
            {roleLabel}
          </span>
          {/* Error or missing school: the chip alone is a fine, honest fallback. */}
          {schoolName ? (
            <div className="mt-1.5 truncate font-display text-sm font-semibold text-ink">{schoolName}</div>
          ) : (
            <div className="mt-1.5 truncate text-xs text-muted">{PORTAL_LABEL[portal]}</div>
          )}
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sidebar
// -----------------------------------------------------------------------------
export default function Sidebar({
  portal,
  isCollapsed,
  isMobileOpen,
  onCloseMobile,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const role = useMe().data?.role;
  const sections = navFor(portal, role);
  const activeHref = activeNavHref(portal, pathname, role);
  const transitionsReady = useTransitionsReady();
  const { logout, pending: loggingOut } = useLogout();

  // Icon-only only on desktop; the mobile drawer always shows full labels.
  const collapsed = isCollapsed && !isMobileOpen;

  // Which group is expanded (accordion). Follows the route: when the pathname
  // changes, the group containing the active row opens again.
  const findActiveGroupKey = () => {
    for (const section of sections) {
      for (const item of section.items) {
        if (item.type === "group" && item.children.some((child) => child.href === activeHref)) {
          return item.key;
        }
      }
    }
    return null;
  };
  const [openState, setOpenState] = useState<{ key: string | null; pathname: string }>({
    key: findActiveGroupKey(),
    pathname,
  });
  const openKey = openState.pathname === pathname ? openState.key : findActiveGroupKey();

  // Collapsed-mode tooltip (custom, because the scroll area would clip a CSS one).
  const cardRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const showTip = (el: HTMLElement, label: string) => {
    if (!collapsed || !cardRef.current) return;
    const row = el.getBoundingClientRect();
    const card = cardRef.current.getBoundingClientRect();
    setTip({ label, top: row.top - card.top + row.height / 2 });
  };
  const hideTip = () => setTip(null);

  // Move focus into the drawer when it opens on mobile.
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isMobileOpen) closeRef.current?.focus();
  }, [isMobileOpen]);

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        aria-hidden={!isMobileOpen}
        tabIndex={isMobileOpen ? 0 : -1}
        onClick={onCloseMobile}
        className={cn(
          // `ink` is dark in light mode and light in dark mode, so the dark theme needs its own dimming tone.
          "fixed inset-0 z-[55] bg-ink/40 backdrop-blur-[2px] transition-opacity duration-300 ease-standard lg:hidden dark:bg-canvas/70",
          isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        id="dashboard-sidebar"
        aria-label="Sidebar"
        className={cn(
          // Mobile: off-canvas drawer. Desktop: sticky column.
          "fixed inset-y-0 left-0 z-[60] w-[18rem] max-w-[86vw] p-3",
          "lg:sticky lg:top-[var(--banner-h,0px)] lg:z-40 lg:h-[calc(100dvh_-_var(--banner-h,0px))] lg:shrink-0 lg:self-start lg:pr-0 lg:translate-x-0",
          collapsed ? "lg:w-[5rem]" : "lg:w-[17.5rem]",
          transitionsReady ? "transition-[width,translate,visibility]" : "transition-[translate,visibility]",
          "duration-300 ease-standard",
          isMobileOpen ? "visible translate-x-0" : "-translate-x-full max-lg:invisible",
        )}
      >
        <div ref={cardRef} className="relative flex h-full flex-col rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
          {/* Header: logo + collapse / close */}
          <div className={cn("flex items-center px-3 pt-3", collapsed ? "flex-col gap-2" : "justify-between gap-2")}>
            <Link
              href={PORTAL_HOME[portal]}
              onClick={onCloseMobile}
              aria-label="Stackable Academy home"
              className="flex items-center gap-2.5 rounded-xl p-1.5 outline-none transition-transform duration-300 ease-standard hover:scale-[1.03] active:scale-95"
            >
              {/* Colour mark in light mode, outline mark in dark mode. */}
              <Image
                src="/logos/stackable-symbol.webp"
                alt=""
                width={28}
                height={32}
                className="h-8 w-auto dark:hidden"
                priority
              />
              <Image
                src="/logos/Symbol.webp"
                alt=""
                width={28}
                height={32}
                className="hidden h-8 w-auto dark:block"
              />
              {collapsed ? null : (
                <span className="font-display text-[17px] font-bold tracking-tight text-ink">Stackable</span>
              )}
            </Link>

            {/* Wrapper spans decide WHICH button shows (Button's own display class is not overridden). */}
            <span className="hidden lg:contents">
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={onToggleCollapse}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!isCollapsed}
                aria-controls="dashboard-sidebar"
                leftIcon={isCollapsed ? "solar:double-alt-arrow-right-linear" : "solar:double-alt-arrow-left-linear"}
              />
            </span>
            <span className="contents lg:hidden">
              <Button
                ref={closeRef}
                variant="ghost"
                size="sm"
                iconOnly
                onClick={onCloseMobile}
                aria-label="Close menu"
                leftIcon="solar:close-circle-linear"
              />
            </span>
          </div>

          <div className="px-3 pt-3">
            <SchoolBlock portal={portal} collapsed={collapsed} />
          </div>

          {/* Navigation */}
          <div className="mt-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
            {sections.map((section, sectionIndex) => (
              <nav key={section.key} aria-label={section.ariaLabel} className="pt-4">
                {collapsed ? (
                  // Icon-only mode: a small dot separates sections (no divider lines).
                  sectionIndex > 0 ? <div aria-hidden="true" className="mx-auto mb-3 size-1 rounded-full bg-field" /> : null
                ) : section.label ? (
                  <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    {section.label}
                  </div>
                ) : null}
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.type === "group" ? item.key : item.href}>
                      {item.type === "link" ? (
                        <SidebarLink
                          item={item}
                          active={item.href === activeHref}
                          collapsed={collapsed}
                          onNavigate={onCloseMobile}
                          onTip={showTip}
                          offTip={hideTip}
                        />
                      ) : (
                        <SidebarGroup
                          item={item}
                          open={openKey === item.key}
                          hasActiveChild={item.children.some((child) => child.href === activeHref)}
                          activeHref={activeHref}
                          collapsed={collapsed}
                          onNavigate={onCloseMobile}
                          onTip={showTip}
                          offTip={hideTip}
                          onToggle={() =>
                            setOpenState({
                              key: openKey === item.key ? null : item.key,
                              pathname,
                            })
                          }
                          onOpenFromCollapsed={() => {
                            setOpenState({ key: item.key, pathname });
                            onToggleCollapse();
                          }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {/* Footer: log out */}
          <div className="p-3">
            {collapsed ? (
              <Button
                variant="ghost"
                iconOnly
                onClick={logout}
                loading={loggingOut}
                aria-label="Log out"
                leftIcon="solar:logout-2-linear"
                className="mx-auto"
                onMouseEnter={(event) => showTip(event.currentTarget, "Log out")}
                onFocus={(event) => showTip(event.currentTarget, "Log out")}
                onMouseLeave={hideTip}
                onBlur={hideTip}
              />
            ) : (
              <Button variant="ghost" fullWidth onClick={logout} loading={loggingOut} leftIcon="solar:logout-2-linear">
                Log out
              </Button>
            )}
          </div>

          {/* Collapsed-mode tooltip (aria-hidden: rows already carry aria-labels) */}
          {tip && collapsed ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-full z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-canvas shadow-pop animate-fade-in"
              style={{ top: tip.top }}
            >
              {tip.label}
            </span>
          ) : null}
        </div>
      </aside>
    </>
  );
}
