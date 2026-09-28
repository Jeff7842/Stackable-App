"use client";

// =============================================================================
// DashboardShell - the ONE shell every portal layout mounts.
// -----------------------------------------------------------------------------
// A role layout (server component) does:
//
//   await requireRole("teacher");
//   return <DashboardShell portal="teacher">{children}</DashboardShell>;
//
// The shell composes, top to bottom / left to right:
//   - ImpersonationBanner   slim gold bar, only while a super-admin views as someone
//   - Sidebar               collapsible (persisted) on desktop, slide-in drawer < lg
//   - Navbar                sticky top bar: title, page-jump search, bell, theme, account
//   - <main>                breadcrumb + the page, capped at max-w-[90rem]
//   - MobileBottomNav       floating pill < lg, with a "More" button for the drawer
//
// To add a menu entry, edit lib/nav.ts. Nothing here needs to change.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import BreadCrumb from "@/components/breadcrumb/bread";
import Navbar from "@/components/header/dashboard-navbar";
import Sidebar from "@/components/sidebar/sidebar";
import { useMe } from "@/hooks/useMe";
import type { Portal } from "@/lib/validation/shared";
import { BANNER_HEIGHT, ImpersonationBanner } from "./ImpersonationBanner";
import { MobileBottomNav } from "./MobileBottomNav";
import { useLocalFlag } from "./hooks";
import { useIdentifyUser } from "./useIdentifyUser";

const COLLAPSED_KEY = "stackable:sidebar-collapsed";

// Light canvas glow: green from the top-right, gold from the bottom-left. Opacities come from the --glow-* tokens (~4% / 3%).
const GLOW = "radial-gradient(60% 100% at 100% 0%, var(--glow-green), transparent 70%), radial-gradient(50% 90% at 0% 100%, var(--glow-gold), transparent 70%)"; // the only gradient in the dashboard

export function DashboardShell({ portal, children }: { portal: Portal; children: ReactNode }) {
  const pathname = usePathname();
  const me = useMe();
  const impersonating = Boolean(me.data?.impersonatedBy);
  useIdentifyUser(me.data);

  // Desktop: collapsed state, remembered in localStorage (safe without storage).
  const [collapsed, setCollapsed] = useLocalFlag(COLLAPSED_KEY);

  // Mobile drawer. Storing the pathname it was opened on makes it close by
  // itself on any route change, with no effect needed.
  const [drawer, setDrawer] = useState({ open: false, pathname });
  const mobileOpen = drawer.open && drawer.pathname === pathname;
  const moreRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => setDrawer({ open: true, pathname });
  const closeMenu = () => {
    setDrawer((current) => ({ ...current, open: false }));
    // Give focus back to the button that opened the drawer.
    moreRef.current?.focus();
  };

  // While the drawer is open: lock body scroll, close on Esc, close if the
  // window grows to desktop width.
  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawer((current) => ({ ...current, open: false }));
        moreRef.current?.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawer((current) => ({ ...current, open: false }));
    };

    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, [mobileOpen]);

  return (
    <div
      // `isolate` makes this the stacking context, so the glow (-z-10) paints above the
      // canvas background but below every piece of content, and modals/drawers stack predictably.
      className="dash-root relative isolate min-h-dvh bg-canvas font-ui text-ink"
      style={{ "--banner-h": impersonating ? BANNER_HEIGHT : "0px" } as CSSProperties}
    >
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-pop focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120]"
      >
        Skip to content
      </a>

      <ImpersonationBanner />

      <div className="flex items-start">
        <Sidebar
          portal={portal}
          isCollapsed={collapsed}
          isMobileOpen={mobileOpen}
          onCloseMobile={closeMenu}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />

        <div
          inert={mobileOpen}
          className="relative flex min-h-[calc(100dvh_-_var(--banner-h))] min-w-0 flex-1 flex-col overflow-x-clip"
        >
          {/* Canvas glow behind the page header. Decorative, never interactive. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
            style={{ background: GLOW }}
          />

          <Navbar portal={portal} />

          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-[90rem] flex-1 px-4 pb-28 pt-2 outline-none sm:px-6 lg:pb-10"
          >
            <div className="mb-4">
              <BreadCrumb />
            </div>
            {children}
          </main>
        </div>
      </div>

      <MobileBottomNav portal={portal} menuOpen={mobileOpen} onOpenMenu={openMenu} moreRef={moreRef} inert={mobileOpen} />
    </div>
  );
}

export default DashboardShell;
