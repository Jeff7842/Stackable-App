"use client";

/**
 * SchoolActionsMenu - the "more actions" kebab for one school (table row and
 * grid card).
 *
 * The menu is portaled to <body> with fixed positioning: a table's scroll
 * container would clip an absolutely positioned popover. It closes on Escape,
 * outside click, scroll and resize, and supports Arrow / Home / End keys.
 *
 * Which items appear depends on the role (see permissions.ts); the server
 * still enforces every one of them.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Button, Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { SchoolRow } from "@/hooks/useSchools";
import type { SchoolPermissions } from "./permissions";
import type { SchoolActions } from "./useSchoolActions";
import { MAX_CODE_CHANGES } from "./utils";

type MenuItem = {
  key: string;
  label: string;
  icon: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Extra gap above this item (tone/whitespace, never a divider line). */
  spaced?: boolean;
  onSelect: () => void;
};

export interface SchoolActionsMenuProps {
  school: SchoolRow;
  permissions: SchoolPermissions;
  actions: SchoolActions;
  onView: (school: SchoolRow) => void;
  onEdit: (school: SchoolRow) => void;
}

type Position = { right: number; top?: number; bottom?: number };

const MENU_WIDTH = 248;
const ITEM_HEIGHT = 40;

export function SchoolActionsMenu({ school, permissions, actions, onView, onEdit }: SchoolActionsMenuProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const open = position !== null;
  const busy = actions.busyId === school.id;

  const suspended = school.status === "suspended";
  const codeChangesLeft = Math.max(0, MAX_CODE_CHANGES - (school.code_change_count ?? 0));

  const items: MenuItem[] = [
    { key: "view", label: "View details", icon: "solar:eye-linear", onSelect: () => onView(school) },
    ...(permissions.canWrite
      ? [
          { key: "edit", label: "Edit details", icon: "solar:pen-2-linear", onSelect: () => onEdit(school) },
          {
            key: "status",
            label: suspended ? "Activate school" : "Suspend school",
            icon: suspended ? "solar:play-circle-linear" : "solar:pause-circle-linear",
            onSelect: () => void actions.toggleStatus(school),
          },
          {
            key: "capacity",
            label: "Increase capacity",
            hint: "+50 users",
            icon: "solar:users-group-rounded-linear",
            onSelect: () => void actions.increaseCapacity(school),
          },
          {
            key: "code",
            label: "Regenerate school code",
            hint: `${codeChangesLeft} left`,
            icon: "solar:restart-linear",
            disabled: codeChangesLeft === 0,
            onSelect: () => void actions.regenerateCode(school),
          },
        ]
      : []),
    ...(permissions.canSecurityCodes
      ? [
          {
            key: "pdf",
            label: "Download security codes",
            hint: "PDF",
            icon: "solar:download-minimalistic-linear",
            onSelect: () => void actions.downloadSecurityCodes(school),
          },
        ]
      : []),
    ...(permissions.canDelete
      ? [
          {
            key: "delete",
            label: "Delete school",
            icon: "solar:trash-bin-trash-linear",
            danger: true,
            spaced: true,
            onSelect: () => void actions.remove(school),
          },
        ]
      : []),
  ];

  const close = (returnFocus = false) => {
    setPosition(null);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  };

  const toggle = () => {
    if (open) return close();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const right = Math.max(8, window.innerWidth - rect.right);
    const estimatedHeight = items.length * ITEM_HEIGHT + 16;
    // Not enough room below the button: open upwards.
    const flip = rect.bottom + estimatedHeight + 8 > window.innerHeight && rect.top > estimatedHeight;
    setPosition(flip ? { right, bottom: window.innerHeight - rect.top + 6 } : { right, top: rect.bottom + 6 });
  };

  // Close when the page scrolls or resizes (a fixed menu would drift away from its button).
  useEffect(() => {
    if (!open) return;
    const dismiss = () => setPosition(null);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus({ preventScroll: true });
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    if (enabled.length === 0) return;
    const index = enabled.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % enabled.length;
    else if (event.key === "ArrowUp") next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    if (next === null) return;
    event.preventDefault();
    enabled[next].focus({ preventScroll: true });
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        iconOnly
        leftIcon="solar:menu-dots-bold"
        aria-label={`More actions for ${school.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        loading={busy}
        onClick={toggle}
      />

      {position
        ? createPortal(
            // Transparent full-screen layer: a press anywhere outside the menu closes it.
            <div className="ui-portal fixed inset-0 z-[110]" onPointerDown={() => close()}>
              <div
                ref={menuRef}
                role="menu"
                aria-label={`Actions for ${school.name}`}
                onKeyDown={onMenuKeyDown}
                onPointerDown={(event) => event.stopPropagation()}
                style={{ width: MENU_WIDTH, right: position.right, top: position.top, bottom: position.bottom }}
                className="fixed max-w-[calc(100vw-1rem)] animate-fade-in rounded-xl bg-surface p-1.5 shadow-pop ring-1 ring-ghost"
              >
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      close();
                      item.onSelect();
                    }}
                    className={cn(
                      "flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-medium",
                      "transition-colors duration-300 ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                      "disabled:cursor-not-allowed disabled:opacity-45",
                      item.spaced && "mt-1.5",
                      item.danger
                        ? "text-danger hover:bg-danger-tint focus-visible:bg-danger-tint"
                        : "text-ink-soft hover:bg-recessed hover:text-ink focus-visible:bg-recessed focus-visible:text-ink",
                    )}
                  >
                    <Icon icon={item.icon} width={18} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint ? <span className="shrink-0 text-xs font-medium text-muted">{item.hint}</span> : null}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
