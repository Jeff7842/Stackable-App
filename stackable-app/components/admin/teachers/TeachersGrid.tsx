"use client";

/**
 * TeachersGrid - the card view (the old "Grid" mode). Same filtered rows as
 * the table, sorted with the same rules, with its own pager because
 * DataTable's pager belongs to the table.
 */
import { useState, type ReactNode } from "react";
import type { SortingState } from "@tanstack/react-table";
import { Avatar, Badge, Button, Select, Skeleton } from "@/components/ui";
import type { TeacherListItem } from "@/hooks/useTeachers";
import { TeacherActionsMenu } from "./TeacherActionsMenu";
import { TeacherStatusBadge } from "./StatusBadge";
import type { TeacherActions } from "./useTeacherActions";
import { formatDate, percentage, sortTeachers } from "./utils";

export interface TeachersGridProps {
  teachers: TeacherListItem[];
  loading: boolean;
  sorting: SortingState;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onView: (teacher: TeacherListItem) => void;
  actions: TeacherActions;
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

function TeacherCard({
  teacher,
  onView,
  actions,
}: Pick<TeachersGridProps, "onView" | "actions"> & { teacher: TeacherListItem }) {
  return (
    <article className="flex flex-col gap-5 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost transition-[translate,box-shadow] duration-300 ease-standard animate-fade-up hover:-translate-y-0.5 hover:shadow-lift">
      <header className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onView(teacher)}
          className="flex min-w-0 items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        >
          <Avatar name={teacher.name} src={teacher.profile_photo} size="lg" />
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-semibold text-ink">{teacher.name}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">{teacher.admission_number}</span>
          </span>
        </button>
        <div className="flex flex-col items-end gap-1.5">
          <TeacherStatusBadge status={teacher.status} />
          {teacher.class_teacher ? (
            <Badge tone="info" size="sm">
              Class teacher
            </Badge>
          ) : null}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label="School">{teacher.school_name || "—"}</Fact>
        <Fact label="Subject">{teacher.subject_name || "—"}</Fact>
        <Fact label="Phone">{teacher.phone || "—"}</Fact>
        <Fact label="Attendance">{percentage(teacher.attendance_percentage)}%</Fact>
        <Fact label="Joined">{formatDate(teacher.created_at)}</Fact>
      </dl>

      <footer className="mt-auto flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" leftIcon="solar:eye-linear" onClick={() => onView(teacher)}>
          Details
        </Button>
        <TeacherActionsMenu teacher={teacher} actions={actions} />
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
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    </div>
  );
}

export function TeachersGrid({ teachers, loading, sorting, pageSize, onPageSizeChange, onView, actions, emptyState }: TeachersGridProps) {
  const [page, setPage] = useState(1);

  const sorted = sortTeachers(teachers, sorting);
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
          : visible.map((teacher) => <TeacherCard key={teacher.id} teacher={teacher} onView={onView} actions={actions} />)}
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

export default TeachersGrid;
