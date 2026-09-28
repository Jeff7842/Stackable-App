"use client";

// Search, class and status filters shared by both the list and grid views
// (so both show identical filtered rows). Fully controlled: the page owns state.

import { Button, Input, Select } from "@/components/ui";
import type { StudentClassOption } from "@/hooks/useStudents";
import { EMPTY_FILTERS, STATUS_LABEL, hasActiveFilters, type StudentFilterState } from "./utils";

const STATUSES = Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[];

export interface StudentFiltersProps {
  value: StudentFilterState;
  onChange: (next: StudentFilterState) => void;
  classes: StudentClassOption[];
  shown: number;
  total: number;
}

export function StudentFilters({ value, onChange, classes, shown, total }: StudentFiltersProps) {
  const active = hasActiveFilters(value);

  return (
    <section aria-label="Filter students" className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ghost animate-fade-up">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <Input
          pill
          type="search"
          autoComplete="off"
          leftIcon="solar:magnifer-linear"
          placeholder="Search name, admission, school or contact"
          aria-label="Search students"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="lg:w-80"
          inputClassName="[&::-webkit-search-cancel-button]:appearance-none"
        />

        <div className="w-40">
          <Select
            pill
            aria-label="Filter by class"
            value={value.classId}
            onChange={(e) => onChange({ ...value, classId: e.target.value })}
          >
            <option value="all">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-40">
          <Select
            pill
            aria-label="Filter by status"
            value={value.status}
            onChange={(e) => onChange({ ...value, status: e.target.value as StudentFilterState["status"] })}
          >
            <option value="all">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </div>

        {active ? (
          <Button size="sm" variant="ghost" leftIcon="solar:close-circle-linear" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-ink-soft tabular-nums" aria-live="polite">
        {shown === total ? `${total} ${total === 1 ? "student" : "students"}` : `${shown} of ${total} students match`}
      </p>
    </section>
  );
}

export default StudentFilters;
