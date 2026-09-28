"use client";

// Searchable school picker (ARIA combobox + listbox) for the create-user form.
// Focus selects the current name so typing replaces it; Arrow keys + Enter
// choose; Esc closes the list first (and only then the drawer). Also links to
// the schools page to add a new school.

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Icon, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { AdminSchoolOption } from "@/hooks/useAdminUsers";

export interface SchoolPickerProps {
  schools: AdminSchoolOption[];
  value: string;
  onChange: (schoolId: string) => void;
  loading?: boolean;
  /** From <Field>'s render prop so the label / error wiring works. */
  id?: string;
  describedBy?: string;
  invalid?: boolean;
}

export function SchoolPicker({ schools, value, onChange, loading, id, describedBy, invalid }: SchoolPickerProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  // What the person has typed. null = not searching, so show the chosen school's name.
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const selected = schools.find((s) => s.id === value);

  const filtered = useMemo(() => {
    const q = (query ?? "").trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => s.name.toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q));
  }, [schools, query]);

  const activeIndex = Math.min(active, filtered.length - 1);
  const optionId = (schoolId: string) => `${listId}-${schoolId}`;

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function choose(school: AdminSchoolOption) {
    onChange(school.id);
    close();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        setActive(Math.min(activeIndex + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
        break;
      case "Enter":
        if (open && filtered[activeIndex]) {
          event.preventDefault();
          choose(filtered[activeIndex]);
        }
        break;
      case "Escape":
        if (open) {
          // Close the list only; do not let the drawer treat this Esc as "close".
          event.stopPropagation();
          close();
        }
        break;
      case "Tab":
        close();
        break;
    }
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[activeIndex] ? optionId(filtered[activeIndex].id) : undefined}
        aria-describedby={describedBy}
        invalid={invalid}
        autoComplete="off"
        placeholder={loading ? "Loading schools..." : "Select school"}
        value={query ?? selected?.name ?? ""}
        onFocus={(event) => {
          setOpen(true);
          event.currentTarget.select();
        }}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        rightAdornment={
          <Icon
            icon="solar:alt-arrow-down-linear"
            width={18}
            className={cn("transition-transform duration-300 ease-standard motion-reduce:transition-none", open && "rotate-180")}
          />
        }
      />

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Schools"
          className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-60 animate-fade-in overflow-y-auto rounded-xl bg-surface p-1.5 shadow-pop ring-1 ring-ghost"
        >
          {filtered.length === 0 ? (
            <li role="presentation" className="px-3 py-4 text-sm text-ink-soft">
              {loading ? "Loading schools..." : "No schools match your search."}
            </li>
          ) : (
            filtered.map((school, index) => (
              <li
                key={school.id}
                id={optionId(school.id)}
                role="option"
                aria-selected={school.id === value}
                // mousedown would blur the input (closing the list) before click lands
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(school)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm",
                  "transition-colors duration-300 ease-standard motion-reduce:transition-none",
                  index === activeIndex ? "bg-primary-tint text-ink" : "text-ink-soft",
                  school.id === value && "font-semibold text-primary-ink",
                )}
              >
                <span className="truncate">{school.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  {school.code}
                  {school.id === value ? <Icon icon="solar:check-circle-linear" width={16} className="text-primary-ink" /> : null}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}

      <Link
        href="/dashboard/schools"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-primary-ink transition-colors duration-300 ease-standard hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Icon icon="solar:add-circle-linear" width={16} />
        Add new school
      </Link>
    </div>
  );
}

export default SchoolPicker;
