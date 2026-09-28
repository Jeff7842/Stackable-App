"use client";

/**
 * SchoolsGrid - the card view (the old "Grid" mode). Same filtered rows as the
 * table, sorted with the same rules, with its own pager because DataTable's
 * pager belongs to the table.
 */
import { useState, type ReactNode } from "react";
import type { SortingState } from "@tanstack/react-table";
import { Avatar, Button, Select, Skeleton } from "@/components/ui";
import type { SchoolRow } from "@/hooks/useSchools";
import { CapacityCell } from "./CapacityMeter";
import { SchoolActionsMenu } from "./SchoolActionsMenu";
import { SchoolStatusBadge } from "./StatusBadge";
import type { SchoolPermissions } from "./permissions";
import type { SchoolActions } from "./useSchoolActions";
import { CAPACITY_FIELDS, expiryHint, formatDate, sortSchools } from "./utils";

export interface SchoolsGridProps {
  schools: SchoolRow[];
  loading: boolean;
  sorting: SortingState;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  permissions: SchoolPermissions;
  actions: SchoolActions;
  onView: (school: SchoolRow) => void;
  onEdit: (school: SchoolRow) => void;
  emptyState: ReactNode;
}

const PAGE_SIZES = [10, 20, 50];
const fmt = (n: number) => n.toLocaleString("en-US");

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function SchoolCard({
  school,
  permissions,
  actions,
  onView,
  onEdit,
}: Pick<SchoolsGridProps, "permissions" | "actions" | "onView" | "onEdit"> & { school: SchoolRow }) {
  const hint = expiryHint(school.subscription_expires_at);

  return (
    <article className="flex flex-col gap-5 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost transition-[translate,box-shadow] duration-300 ease-standard animate-fade-up hover:-translate-y-0.5 hover:shadow-lift">
      <header className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onView(school)}
          className="flex min-w-0 items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        >
          <Avatar name={school.name} src={school.logo} size="lg" />
          <span className="min-w-0">
            <span className="block font-display text-base font-semibold break-words text-ink">{school.name}</span>
            <span className="mt-0.5 block text-xs text-muted tabular-nums">
              {school.code} · #{school.school_id}
            </span>
          </span>
        </button>
        <SchoolStatusBadge status={school.status} />
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label="Head">{school.head_name || "—"}</Fact>
        <Fact label="Owner">{school.owner_name || "—"}</Fact>
        <Fact label="Phone">{school.phone_1 || "—"}</Fact>
        <Fact label="Email">
          <span title={school.email ?? undefined}>{school.email || "—"}</span>
        </Fact>
        <Fact label="Package">{school.subscription_package}</Fact>
        <Fact label="Expiry">
          {formatDate(school.subscription_expires_at)}
          {hint ? (
            <span className={hint.tone === "danger" ? "ml-1.5 text-[11px] text-danger" : "ml-1.5 text-[11px] text-warning"}>
              {hint.text}
            </span>
          ) : null}
        </Fact>
      </dl>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl bg-recessed p-4 sm:grid-cols-3">
        {CAPACITY_FIELDS.map((field) => (
          <div key={field.id}>
            <dt className="mb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">{field.label}</dt>
            <dd>
              <CapacityCell actual={school[field.actual]} expected={school[field.expected]} />
            </dd>
          </div>
        ))}
      </dl>

      <footer className="mt-auto flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" leftIcon="solar:eye-linear" onClick={() => onView(school)}>
          Details
        </Button>
        {permissions.canWrite ? (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            leftIcon="solar:pen-2-linear"
            aria-label={`Edit ${school.name}`}
            onClick={() => onEdit(school)}
          />
        ) : null}
        <SchoolActionsMenu school={school} permissions={permissions} actions={actions} onView={onView} onEdit={onEdit} />
      </footer>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
      <Skeleton className="h-24" rounded="xl" />
    </div>
  );
}

export function SchoolsGrid({
  schools,
  loading,
  sorting,
  pageSize,
  onPageSizeChange,
  permissions,
  actions,
  onView,
  onEdit,
  emptyState,
}: SchoolsGridProps) {
  const [page, setPage] = useState(1);

  const sorted = sortSchools(schools, sorting);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  const summary =
    sorted.length === 0 ? "No entries" : `Showing ${fmt(start + 1)}-${fmt(start + visible.length)} of ${fmt(sorted.length)}`;

  if (!loading && sorted.length === 0) {
    return <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">{emptyState}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-busy={loading || undefined}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : visible.map((school) => (
              <SchoolCard
                key={school.id || `school-${school.school_id}`}
                school={school}
                permissions={permissions}
                actions={actions}
                onView={onView}
                onEdit={onEdit}
              />
            ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-3 shadow-soft ring-1 ring-ghost sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-ink-soft tabular-nums" aria-live="polite">
          {loading ? <Skeleton className="h-3.5 w-36" /> : summary}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="hidden sm:inline">Rows per page</span>
            <Select
              size="sm"
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => {
                onPageSizeChange(Number(event.target.value));
                setPage(1);
              }}
              className="w-[4.75rem]"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              leftIcon="solar:alt-arrow-left-linear"
              aria-label="Previous page"
              disabled={loading || current <= 1}
              onClick={() => setPage(current - 1)}
            />
            <span className="min-w-[5.5rem] text-center text-xs text-ink-soft tabular-nums">
              Page {fmt(current)} of {fmt(pageCount)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              leftIcon="solar:alt-arrow-right-linear"
              aria-label="Next page"
              disabled={loading || current >= pageCount}
              onClick={() => setPage(current + 1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
