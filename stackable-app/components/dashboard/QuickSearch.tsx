"use client";

// =============================================================================
// QuickSearch - the big rounded search pill in the top bar.
// -----------------------------------------------------------------------------
// It is a page-jump (command palette lite): it filters the portal's own menu
// entries (lib/nav.ts) on the client. No backend. Keyboard: Ctrl/Cmd+K focuses,
// Up/Down moves, Enter opens, Esc closes. Follows the ARIA combobox pattern.
// =============================================================================

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useMe } from "@/hooks/useMe";
import { searchNav } from "@/lib/nav";
import type { Portal } from "@/lib/validation/shared";
import { NavIcon } from "@/components/sidebar/sidebar";
import { useShortcutLabel } from "./hooks";

type QuickSearchProps = {
  portal: Portal;
  className?: string;
  /** Focus the input on mount (used by the mobile search row). */
  autoFocus?: boolean;
  /** Register the global Ctrl/Cmd+K shortcut (one instance only). */
  enableShortcut?: boolean;
  /** Called after a page was opened or the search was dismissed. */
  onDone?: () => void;
};

export function QuickSearch({ portal, className, autoFocus, enableShortcut, onDone }: QuickSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const shortcut = useShortcutLabel();
  const listId = useId();

  const results = searchNav(portal, query, 8, useMe().data?.role);
  const activeIndex = results.length === 0 ? -1 : Math.min(cursor, results.length - 1);
  const optionId = (index: number) => `${listId}-opt-${index}`;

  // Ctrl/Cmd+K focuses the pill from anywhere on the page.
  useEffect(() => {
    if (!enableShortcut) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableShortcut]);

  const finish = () => {
    setQuery("");
    setOpen(false);
    setCursor(0);
    inputRef.current?.blur();
    onDone?.();
  };

  const go = (href: string) => {
    console.info("[dashboard] quick search ->", href);
    router.push(href);
    finish();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        setCursor(results.length === 0 ? 0 : (activeIndex + 1) % results.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setOpen(true);
        setCursor(results.length === 0 ? 0 : (activeIndex - 1 + results.length) % results.length);
        break;
      case "Enter":
        if (open && activeIndex >= 0) {
          event.preventDefault();
          go(results[activeIndex].href);
        }
        break;
      case "Escape":
        event.preventDefault();
        if (open && query) {
          setQuery("");
        } else {
          finish();
        }
        break;
    }
  };

  return (
    <div
      className={cn("relative w-full", className)}
      onBlur={(event) => {
        // Close only when focus leaves the whole widget (not when it moves to an option).
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Icon
        icon="solar:magnifer-linear"
        width={20}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        autoFocus={autoFocus}
        onChange={(event) => {
          setQuery(event.target.value);
          setCursor(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Jump to a page..."
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-label="Jump to a page"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        className={cn(
          "h-11 w-full rounded-full bg-surface pl-12 pr-4 text-sm font-medium text-ink shadow-soft ring-1 ring-ghost md:h-12 lg:pr-20",
          "placeholder:text-muted outline-none transition-[box-shadow] duration-300 ease-standard",
          "hover:shadow-lift focus-visible:ring-2 focus-visible:ring-focus",
        )}
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md bg-recessed px-1.5 py-0.5 text-[11px] font-semibold text-muted lg:inline-flex"
      >
        {shortcut}
      </kbd>

      {open ? (
        <div className="absolute inset-x-0 top-full z-50 mt-2 animate-fade-in rounded-2xl bg-surface p-2 shadow-pop ring-1 ring-ghost">
          <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {query.trim() ? "Pages" : "Quick links"}
          </div>
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted">
              No page matches &ldquo;{query.trim()}&rdquo;.
            </div>
          ) : (
            <ul id={listId} role="listbox" aria-label="Pages" className="space-y-0.5">
              {results.map((entry, index) => {
                const active = index === activeIndex;
                return (
                  <li key={entry.href} role="presentation">
                    <button
                      type="button"
                      id={optionId(index)}
                      role="option"
                      aria-selected={active}
                      // Keep focus in the input so the widget does not close before the click lands.
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => go(entry.href)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-none",
                        "transition-[background-color,color] duration-300 ease-standard",
                        active ? "bg-primary-tint text-primary-ink" : "text-ink-soft",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          active ? "bg-surface text-primary" : "bg-recessed text-muted",
                        )}
                      >
                        <NavIcon icon={entry.icon} active={active} width={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{entry.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {[entry.group && entry.group !== entry.title ? entry.group : null, entry.section]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {active ? <Icon icon="solar:alt-arrow-right-linear" width={16} className="shrink-0" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default QuickSearch;
