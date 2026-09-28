"use client";

/**
 * SchoolFilters - the search pill, the three filters (school status,
 * subscription status, package), "Sort by" and the capacity-breakdown toggle.
 * Shared by the list and the grid, so both views filter and sort identically.
 * Fully controlled: the page owns the state.
 */
import { Button, Input, Select } from "@/components/ui";
import type { SchoolStatus, SubscriptionStatus } from "@/hooks/useSchools";
import {
  EMPTY_FILTERS,
  SCHOOL_STATUS_OPTIONS,
  SORT_OPTIONS,
  SUBSCRIPTION_STATUS_OPTIONS,
  hasActiveFilters,
  type SchoolFilters as Filters,
} from "./utils";

export interface SchoolFiltersProps {
  filters: Filters;
  onChange: (next: Filters) => void;
  /** Distinct package names found in the data. */
  packages: string[];
  /** Value of the current "Sort by" option ("" when a header sort matches none). */
  sortValue: string;
  onSortChange: (value: string) => void;
  /** Only the list view has the optional per-category capacity columns. */
  showCapacityToggle: boolean;
  capacityColumns: boolean;
  onToggleCapacityColumns: () => void;
  shown: number;
  total: number;
}

export function SchoolFilters({
  filters,
  onChange,
  packages,
  sortValue,
  onSortChange,
  showCapacityToggle,
  capacityColumns,
  onToggleCapacityColumns,
  shown,
  total,
}: SchoolFiltersProps) {
  const active = hasActiveFilters(filters);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });

  return (
    <section
      aria-label="Filter schools"
      className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost animate-fade-up"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <Input
          pill
          type="search"
          autoComplete="off"
          leftIcon="solar:magnifer-linear"
          placeholder="Search school, head, owner, code, email or phone"
          aria-label="Search schools"
          value={filters.search}
          onChange={(event) => set("search", event.target.value)}
          className="lg:w-80"
          inputClassName="[&::-webkit-search-cancel-button]:appearance-none"
        />

        <Select
          pill
          aria-label="School status"
          value={filters.status}
          onChange={(event) => set("status", event.target.value as "all" | SchoolStatus)}
          className="lg:w-40"
        >
          <option value="all">All statuses</option>
          {SCHOOL_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          pill
          aria-label="Subscription status"
          value={filters.subscription}
          onChange={(event) => set("subscription", event.target.value as "all" | SubscriptionStatus)}
          className="lg:w-44"
        >
          <option value="all">All subscriptions</option>
          {SUBSCRIPTION_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          pill
          aria-label="Package"
          value={filters.pkg}
          onChange={(event) => set("pkg", event.target.value)}
          className="lg:w-40"
        >
          <option value="all">All packages</option>
          {packages.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>

        <Select
          pill
          aria-label="Sort by"
          leftIcon="solar:sort-vertical-linear"
          value={sortValue}
          onChange={(event) => onSortChange(event.target.value)}
          className="lg:w-48"
        >
          {sortValue === "" ? (
            <option value="" disabled>
              Default order
            </option>
          ) : null}
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <div className="flex items-center gap-2 lg:ml-auto">
          {active ? (
            <Button variant="ghost" size="sm" leftIcon="solar:close-circle-linear" onClick={() => onChange(EMPTY_FILTERS)}>
              Clear filters
            </Button>
          ) : null}
          {showCapacityToggle ? (
            <Button
              variant={capacityColumns ? "secondary" : "ghost"}
              size="sm"
              leftIcon="solar:chart-2-linear"
              aria-pressed={capacityColumns}
              onClick={onToggleCapacityColumns}
            >
              Capacity columns
            </Button>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-soft tabular-nums" aria-live="polite">
        {shown === total ? `${total} ${total === 1 ? "school" : "schools"}` : `${shown} of ${total} schools match`}
      </p>
    </section>
  );
}
