"use client";

// =============================================================================
// Navbar - the sticky top bar of every dashboard portal.
// -----------------------------------------------------------------------------
// Left:   eyebrow (portal) + page title, derived from the URL and lib/nav.ts.
// Centre: quick page-jump search pill (Ctrl/Cmd+K).
// Right:  theme toggle, notification bell, account menu.
// It is sticky (in normal flow), so pages need no top-padding hack. The
// impersonation banner sits above it; `--banner-h` (set by DashboardShell)
// keeps the sticky offset correct.
// =============================================================================

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useMe } from "@/hooks/useMe";
import { PORTAL_LABEL, findNavItem, notificationsHref, prettifySegment } from "@/lib/nav";
import type { Portal } from "@/lib/validation/shared";
import { QuickSearch } from "@/components/dashboard/QuickSearch";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { useScrolled } from "@/components/dashboard/hooks";
import { useUnreadCount } from "@/components/dashboard/useUnreadCount";
import ProfileModal from "./Profile-Modal";

type NavbarProps = {
  portal: Portal;
};

/** Page title: deepest matching menu row, else the last URL segment, else the portal name. */
function usePageTitle(portal: Portal): string {
  const pathname = usePathname();
  const item = findNavItem(portal, pathname, useMe().data?.role);
  if (item) return item.title;
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  return prettifySegment(last) || PORTAL_LABEL[portal];
}

export default function Navbar({ portal }: NavbarProps) {
  const title = usePageTitle(portal);
  const scrolled = useScrolled();
  const { count } = useUnreadCount();
  const bellHref = notificationsHref(portal, useMe().data?.role);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  const bellLabel = count > 0 ? `Notifications, ${count} unread` : "Notifications";
  const bellContent = (
    <>
      <Icon icon="solar:bell-linear" width={20} />
      {count > 0 ? (
        <span aria-hidden="true" className="absolute right-2 top-2 inline-flex size-2">
          <span className="absolute inset-0 rounded-full bg-primary animate-pulse-dot" />
          <span className="relative size-2 rounded-full bg-primary" />
        </span>
      ) : null}
    </>
  );

  return (
    <>
      <header
        className={cn(
          "sticky top-[var(--banner-h,0px)] z-30 backdrop-blur-md transition-[background-color,box-shadow] duration-300 ease-standard",
          scrolled ? "bg-surface/85 shadow-soft" : "bg-canvas/60",
        )}
      >
        <div className="mx-auto flex w-full max-w-[90rem] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1 md:flex-none md:basis-56 lg:basis-64">
            <div className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              {PORTAL_LABEL[portal]}
            </div>
            <h1 className="truncate font-display text-xl font-bold leading-tight text-ink sm:text-2xl">{title}</h1>
          </div>

          <div className="hidden min-w-0 flex-1 md:block">
            <QuickSearch portal={portal} enableShortcut className="mx-auto max-w-xl" />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span className="md:hidden">
              <Button
                variant="ghost"
                iconOnly
                aria-label={mobileSearch ? "Close search" : "Search pages"}
                aria-expanded={mobileSearch}
                leftIcon={mobileSearch ? "solar:close-circle-linear" : "solar:magnifer-linear"}
                onClick={() => setMobileSearch((current) => !current)}
              />
            </span>

            <ThemeToggle />

            {bellHref ? (
              <Button as="a" href={bellHref} variant="ghost" iconOnly aria-label={bellLabel}>
                {bellContent}
              </Button>
            ) : (
              <Button variant="ghost" iconOnly aria-label={bellLabel}>
                {bellContent}
              </Button>
            )}

            <UserMenu portal={portal} onOpenProfile={() => setProfileOpen(true)} />
          </div>
        </div>

        {mobileSearch ? (
          <div className="px-4 pb-3 md:hidden">
            <QuickSearch portal={portal} autoFocus onDone={() => setMobileSearch(false)} />
          </div>
        ) : null}
      </header>

      {/* Outside <header>: its backdrop blur would otherwise become the modal's positioning box. */}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} portal={portal} />
    </>
  );
}
