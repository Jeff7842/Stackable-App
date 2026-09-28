"use client";

// =============================================================================
// UserMenu - avatar + role chip in the top bar, opening a small dropdown with
// "View profile", "Settings" and "Log out".
// -----------------------------------------------------------------------------
// Identity comes from useMe(). While loading we show skeletons; if the request
// fails we fall back to a generic "Account" + the portal's role label so the
// shell never breaks. Keyboard: Enter/Space opens, Up/Down moves, Esc closes.
// =============================================================================

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { useMe } from "@/hooks/useMe";
import { PORTAL_LABEL, settingsHref } from "@/lib/nav";
import type { Portal } from "@/lib/validation/shared";
import { PORTAL_CHIP, displayName, formatRole } from "./format";
import { useLogout } from "./useLogout";

const ITEM =
  "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium outline-none " +
  "transition-[background-color,color,translate,scale] duration-300 ease-standard active:scale-[0.98] " +
  "focus-visible:-outline-offset-2";

type UserMenuProps = {
  portal: Portal;
  onOpenProfile: () => void;
};

export function UserMenu({ portal, onOpenProfile }: UserMenuProps) {
  const me = useMe();
  const { logout, pending: loggingOut } = useLogout();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const settings = settingsHref(portal);
  const name = displayName(me.data);
  const role = formatRole(me.data?.role, portal);
  const loading = me.isPending;

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  const close = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  // While open: close on outside click, focus the first item.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = items();
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      nodes[(index + 1) % nodes.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={loading ? "Account menu" : `Account menu for ${name}`}
        className={cn(
          "group flex items-center gap-2 rounded-full bg-surface p-1 shadow-soft ring-1 ring-ghost outline-none md:pr-3",
          "transition-[box-shadow,translate,scale] duration-300 ease-standard",
          "hover:-translate-y-0.5 hover:shadow-lift active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        )}
      >
        {loading ? (
          <Skeleton className="size-8" rounded="full" />
        ) : (
          <Avatar name={name} size="sm" status="online" />
        )}

        <span className="hidden min-w-0 text-left md:block" aria-busy={loading || undefined}>
          {loading ? (
            <span className="block space-y-1.5 py-0.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-14" />
            </span>
          ) : (
            <>
              <span className="block max-w-[9rem] truncate text-sm font-semibold leading-tight text-ink">{name}</span>
              <span
                className={cn(
                  "mt-0.5 inline-flex rounded-full px-1.5 text-[10px] font-bold uppercase leading-4 tracking-[0.1em]",
                  PORTAL_CHIP[portal],
                )}
              >
                {role}
              </span>
            </>
          )}
        </span>

        <Icon
          icon="solar:alt-arrow-down-linear"
          width={16}
          className={cn(
            "hidden text-muted transition-transform duration-300 ease-standard md:block",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] origin-top-right animate-fade-in rounded-2xl bg-surface p-2 shadow-pop ring-1 ring-ghost"
        >
          <div className="mb-1 rounded-xl bg-recessed p-3">
            <div className="truncate font-display text-sm font-semibold text-ink">{me.isError ? "Account" : name}</div>
            {me.isError ? (
              <div className="mt-0.5 text-xs text-danger">We could not load your details.</div>
            ) : (
              <>
                {me.data?.email ? <div className="truncate text-xs text-muted">{me.data.email}</div> : null}
                <div className="mt-1.5 truncate text-xs font-medium text-ink-soft">
                  {me.data?.schoolName ?? PORTAL_LABEL[portal]}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onOpenProfile();
            }}
            className={cn(ITEM, "text-ink-soft hover:bg-recessed hover:text-ink")}
          >
            <Icon icon="solar:user-circle-linear" width={20} />
            View profile
          </button>

          {settings ? (
            <Link
              href={settings}
              role="menuitem"
              onClick={() => close()}
              className={cn(ITEM, "text-ink-soft hover:bg-recessed hover:text-ink")}
            >
              <Icon icon="solar:settings-linear" width={20} />
              Settings
            </Link>
          ) : null}

          <button
            type="button"
            role="menuitem"
            disabled={loggingOut}
            onClick={() => {
              void logout();
            }}
            className={cn(ITEM, "text-danger hover:bg-danger-tint disabled:pointer-events-none disabled:opacity-60")}
          >
            <Icon icon="solar:logout-2-linear" width={20} />
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default UserMenu;
