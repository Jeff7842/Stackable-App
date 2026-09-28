"use client";

// =============================================================================
// MobileBottomNav - the floating bottom pill shown below the `lg` breakpoint.
// -----------------------------------------------------------------------------
// Ported from the marketing site's mobile pill (stackable_home_v2): a floating
// rounded bar with icon destinations and a gold active item. Here it shows the
// portal's `primary` destinations from lib/nav.ts plus a "More" button that
// opens the full menu drawer. The active item expands to show its label.
// Colours: an inverted ink pill in light mode, a surface pill in dark mode
// (tokens only, so both themes work).
// =============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Ref } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { activeNavHref, primaryNav } from "@/lib/nav";
import type { Portal } from "@/lib/validation/shared";
import { NavIcon } from "@/components/sidebar/sidebar";

type MobileBottomNavProps = {
  portal: Portal;
  menuOpen: boolean;
  onOpenMenu: () => void;
  moreRef?: Ref<HTMLButtonElement>;
  /** Hide from keyboard / AT while the drawer is open. */
  inert?: boolean;
};

const ITEM =
  "flex h-11 items-center justify-center gap-2 rounded-xl outline-none " +
  "transition-[background-color,color,scale] duration-300 ease-standard active:scale-95";

export function MobileBottomNav({ portal, menuOpen, onOpenMenu, moreRef, inert }: MobileBottomNavProps) {
  const pathname = usePathname();
  const activeHref = activeNavHref(portal, pathname);
  const items = primaryNav(portal, 4);

  return (
    <nav
      aria-label="Primary"
      inert={inert}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <ul
        className={cn(
          "pointer-events-auto flex items-center gap-1 rounded-2xl p-1.5 shadow-pop backdrop-blur-2xl",
          "bg-ink/90 text-canvas/60 ring-1 ring-canvas/10",
          "dark:bg-surface/90 dark:text-muted dark:ring-ghost",
        )}
      >
        {items.map((entry) => {
          const active = entry.href === activeHref;
          // Group entries read better by their group name ("Students", not "All students").
          const text = entry.group ?? entry.label;
          return (
            <li key={entry.href}>
              <Link
                href={entry.href}
                aria-current={active ? "page" : undefined}
                aria-label={text}
                className={cn(
                  ITEM,
                  active
                    ? "bg-canvas/10 px-3 text-accent dark:bg-recessed"
                    : "w-11 hover:text-canvas dark:hover:text-ink",
                )}
              >
                <NavIcon icon={entry.icon} active={active} width={22} />
                {active ? (
                  <span className="max-w-[6.5rem] truncate text-xs font-semibold animate-fade-in">{text}</span>
                ) : null}
              </Link>
            </li>
          );
        })}

        <li>
          <button
            ref={moreRef}
            type="button"
            onClick={onOpenMenu}
            aria-label="More"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-controls="dashboard-sidebar"
            className={cn(ITEM, "w-11 hover:text-canvas dark:hover:text-ink")}
          >
            <Icon icon="solar:hamburger-menu-linear" width={22} />
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default MobileBottomNav;
