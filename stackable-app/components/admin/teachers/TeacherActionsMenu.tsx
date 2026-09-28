"use client";

/**
 * TeacherActionsMenu - the "more actions" kebab for one teacher (table row
 * and grid card): profile, edit, timetable, attendance, suspend / activate
 * and delete. Portaled to <body> with fixed positioning so a scrolling table
 * never clips the popover. Closes on Escape, outside click, scroll and
 * resize; Arrow / Home / End keys move between items.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { TeacherListItem } from "@/hooks/useTeachers";
import type { TeacherActions } from "./useTeacherActions";

type MenuItem = {
  key: string;
  label: string;
  icon: string;
  danger?: boolean;
  spaced?: boolean;
  onSelect: () => void;
};

export interface TeacherActionsMenuProps {
  teacher: TeacherListItem;
  actions: TeacherActions;
}

type Position = { right: number; top?: number; bottom?: number };

const MENU_WIDTH = 220;
const ITEM_HEIGHT = 40;

export function TeacherActionsMenu({ teacher, actions }: TeacherActionsMenuProps) {
  const router = useRouter();
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const open = position !== null;
  const busy = actions.busyId === teacher.id;
  const suspended = teacher.status === "suspended";

  const items: MenuItem[] = [
    { key: "profile", label: "View profile", icon: "solar:eye-linear", onSelect: () => router.push(`/dashboard/teachers/${teacher.id}`) },
    { key: "edit", label: "Edit teacher", icon: "solar:pen-2-linear", onSelect: () => router.push(`/dashboard/teachers/${teacher.id}/edit`) },
    {
      key: "timetable",
      label: "Timetable",
      icon: "solar:calendar-linear",
      onSelect: () => router.push(`/dashboard/teachers/${teacher.id}/timetable`),
    },
    {
      key: "attendance",
      label: "Attendance",
      icon: "solar:clock-circle-linear",
      onSelect: () => router.push(`/dashboard/teachers/${teacher.id}/students`),
    },
    {
      key: "status",
      label: suspended ? "Activate teacher" : "Suspend teacher",
      icon: suspended ? "solar:lock-keyhole-minimalistic-unlocked-linear" : "solar:lock-keyhole-minimalistic-linear",
      spaced: true,
      onSelect: () => void actions.toggleStatus(teacher),
    },
    {
      key: "delete",
      label: "Delete teacher",
      icon: "solar:trash-bin-trash-linear",
      danger: true,
      onSelect: () => void actions.deleteTeacher(teacher),
    },
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
    const flip = rect.bottom + estimatedHeight + 8 > window.innerHeight && rect.top > estimatedHeight;
    setPosition(flip ? { right, bottom: window.innerHeight - rect.top + 6 } : { right, top: rect.bottom + 6 });
  };

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

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus({ preventScroll: true });
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
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
        aria-label={`More actions for ${teacher.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        loading={busy}
        onClick={toggle}
      />

      {position
        ? createPortal(
            <div className="ui-portal fixed inset-0 z-[110]" onPointerDown={() => close()}>
              <div
                ref={menuRef}
                role="menu"
                aria-label={`Actions for ${teacher.name}`}
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
                    onClick={() => {
                      close();
                      item.onSelect();
                    }}
                    className={cn(
                      "flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-medium",
                      "transition-colors duration-300 ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                      item.spaced && "mt-1.5",
                      item.danger
                        ? "text-danger hover:bg-danger-tint focus-visible:bg-danger-tint"
                        : "text-ink-soft hover:bg-recessed hover:text-ink focus-visible:bg-recessed focus-visible:text-ink",
                    )}
                  >
                    <Icon icon={item.icon} width={18} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
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

export default TeacherActionsMenu;
