"use client";

/**
 * Tabs - pill-style tab list with optional panels.
 *
 * Uncontrolled:
 *   <Tabs defaultValue="overview" items={[
 *     { id: "overview", label: "Overview", content: <Overview /> },
 *     { id: "grades", label: "Grades", icon: "solar:chart-2-linear", count: 4, content: <Grades /> },
 *   ]} />
 *
 * Controlled (e.g. driven by the URL): pass `value` + `onValueChange`.
 * With no `content` on the items it renders only the tab list (use the value
 * yourself to switch what is shown).
 *
 * Keyboard: ArrowLeft/ArrowRight move + activate (wraps, skips disabled),
 * Home/End jump to first/last. Roving tabindex: only the active tab is in the
 * page tab order; the panel is tabbable so its content is reachable.
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export interface TabItem {
  id: string;
  label: ReactNode;
  /** Iconify name (linear style). */
  icon?: string;
  /** Small count chip after the label. */
  count?: number;
  disabled?: boolean;
  /** Rendered in the panel below when this tab is active. */
  content?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  /** Controlled active tab id. */
  value?: string;
  /** Initial tab id when uncontrolled (defaults to the first enabled tab). */
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  size?: "sm" | "md";
  /** Stretch the tab list to the container width. */
  fullWidth?: boolean;
  className?: string;
  listClassName?: string;
  panelClassName?: string;
  "aria-label"?: string;
}

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  size = "md",
  fullWidth = false,
  className,
  listClassName,
  panelClassName,
  "aria-label": ariaLabel,
}: TabsProps) {
  const baseId = useId();
  const firstEnabled = items.find((i) => !i.disabled)?.id;
  const [inner, setInner] = useState<string | undefined>(defaultValue ?? firstEnabled);
  const isControlled = value !== undefined;
  const activeId = isControlled ? value : inner;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const select = (id: string) => {
    if (!isControlled) setInner(id);
    onValueChange?.(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((i) => !i.disabled);
    if (enabled.length === 0) return;
    const currentIndex = enabled.findIndex((i) => i.id === activeId);
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        next = (currentIndex + 1) % enabled.length;
        break;
      case "ArrowLeft":
        next = (currentIndex - 1 + enabled.length) % enabled.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = enabled[next];
    select(target.id);
    tabRefs.current[target.id]?.focus();
  };

  const activeItem = items.find((i) => i.id === activeId);
  const hasPanels = items.some((i) => i.content !== undefined);
  const sizing = size === "sm" ? "h-8 px-3 text-xs gap-1.5" : "h-9 px-4 text-sm gap-2";

  return (
    <div className={className}>
      <div className="max-w-full overflow-x-auto">
        <div
          role="tablist"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          className={cn(
            "gap-1 rounded-xl bg-recessed p-1",
            fullWidth ? "flex w-full" : "inline-flex",
            listClassName,
          )}
        >
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  tabRefs.current[item.id] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${item.id}`}
                aria-selected={active}
                aria-controls={hasPanels && active ? `${baseId}-panel-${item.id}` : undefined}
                tabIndex={active ? 0 : -1}
                disabled={item.disabled}
                onClick={() => select(item.id)}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-semibold",
                  "transition-[background-color,color,box-shadow] duration-300 ease-standard",
                  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
                  "disabled:pointer-events-none disabled:opacity-40",
                  sizing,
                  fullWidth && "flex-1",
                  active ? "bg-surface text-ink shadow-soft" : "text-ink-soft hover:text-ink",
                )}
              >
                {item.icon ? <Icon icon={item.icon} width={size === "sm" ? 14 : 16} /> : null}
                {item.label}
                {item.count !== undefined ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] leading-4 tabular-nums",
                      active ? "bg-primary-tint text-primary-ink" : "bg-field text-ink-soft",
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {hasPanels && activeItem ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeItem.id}`}
          aria-labelledby={`${baseId}-tab-${activeItem.id}`}
          tabIndex={0}
          className={cn("mt-4 animate-fade-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", panelClassName)}
        >
          {activeItem.content}
        </div>
      ) : null}
    </div>
  );
}

export default Tabs;
