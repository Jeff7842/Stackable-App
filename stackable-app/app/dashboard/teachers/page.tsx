"use client";

/**
 * Teachers (/dashboard/teachers) - the school's teacher register: search /
 * filter, list or grid view, quick suspend / activate, and delete.
 *
 * This page only orchestrates; the pieces live in components/admin/teachers/**
 * and the data layer in hooks/useTeachers.ts (TanStack Query, Prisma-backed).
 * Reads already went through the API before this redesign; the remaining
 * direct Supabase mutation calls (freeze / delete) are now gone too, replaced
 * by useUpdateTeacher / useDeleteTeacher via useTeacherActions.
 *
 * The dashboard navbar already renders the page <h1>, so this header has none.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SortingState } from "@tanstack/react-table";
import { Button, EmptyState, Tabs } from "@/components/ui";
import { useTeachers, type TeacherListItem } from "@/hooks/useTeachers";
import { TeacherFilters } from "@/components/admin/teachers/TeacherFilters";
import { TeachersGrid } from "@/components/admin/teachers/TeachersGrid";
import { TeachersTable } from "@/components/admin/teachers/TeachersTable";
import { useTeacherActions } from "@/components/admin/teachers/useTeacherActions";
import { EMPTY_FILTERS, filterTeachers, hasActiveFilters, type TeacherFilterState } from "@/components/admin/teachers/utils";

type ViewMode = "list" | "grid";

const DEFAULT_SORTING: SortingState = [{ id: "teacher", desc: false }];

export default function TeachersPage() {
  const router = useRouter();
  const teachersQuery = useTeachers();
  const actions = useTeacherActions();

  const teachersData = teachersQuery.data?.data;
  const teachers: TeacherListItem[] = useMemo(() => teachersData ?? [], [teachersData]);

  // Subject options are derived from the enriched teacher rows (each carries subject_name),
  // same trick the page already used before this redesign.
  const subjects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of teachers) if (t.subject_id != null && t.subject_name) seen.set(String(t.subject_id), t.subject_name);
    return Array.from(seen.entries()).map(([id, subject_name]) => ({ id: Number(id), subject_name }));
  }, [teachers]);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filters, setFilters] = useState<TeacherFilterState>(EMPTY_FILTERS);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pageSize, setPageSize] = useState(10);

  const filtered = filterTeachers(teachers, filters);

  function openProfile(teacher: TeacherListItem) {
    router.push(`/dashboard/teachers/${teacher.id}`);
  }

  const emptyState = hasActiveFilters(filters) ? (
    <EmptyState
      icon="solar:users-group-rounded-linear"
      title="No teachers found"
      description="Your current filters returned no teacher records."
      action={
        <Button variant="secondary" leftIcon="solar:restart-linear" onClick={() => setFilters(EMPTY_FILTERS)}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon="solar:users-group-rounded-linear"
      title="No teachers yet"
      description="Teachers added to your school will show up here."
      action={
        <Button leftIcon="solar:add-circle-linear" as="a" href="/dashboard/teachers/new">
          Add teacher
        </Button>
      }
    />
  );

  const errorState = (
    <EmptyState
      icon="solar:danger-triangle-linear"
      title="Teachers could not be loaded"
      description={teachersQuery.error instanceof Error ? teachersQuery.error.message : "Failed to fetch teachers."}
      action={
        <Button variant="secondary" leftIcon="solar:refresh-linear" onClick={() => void teachersQuery.refetch()}>
          Try again
        </Button>
      }
    />
  );

  const resetKey = JSON.stringify(filters);

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
          Teacher register, filtering, quick actions and direct access to teacher details, timetable and attendance.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            size="sm"
            aria-label="View mode"
            value={viewMode}
            onValueChange={(id) => setViewMode(id as ViewMode)}
            items={[
              { id: "list", label: "List", icon: "solar:list-linear" },
              { id: "grid", label: "Grid", icon: "solar:widget-2-linear" },
            ]}
          />
          <Button leftIcon="solar:add-circle-linear" as="a" href="/dashboard/teachers/new">
            Add teacher
          </Button>
        </div>
      </div>

      <TeacherFilters value={filters} onChange={setFilters} subjects={subjects} shown={filtered.length} total={teachers.length} />

      {teachersQuery.isError ? (
        <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">{errorState}</div>
      ) : viewMode === "list" ? (
        <TeachersTable
          key={resetKey}
          teachers={filtered}
          loading={teachersQuery.isLoading}
          emptyState={emptyState}
          sorting={sorting}
          onSortingChange={setSorting}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onView={openProfile}
          actions={actions}
        />
      ) : (
        <TeachersGrid
          key={resetKey}
          teachers={filtered}
          loading={teachersQuery.isLoading}
          sorting={sorting}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onView={openProfile}
          actions={actions}
          emptyState={emptyState}
        />
      )}
    </div>
  );
}
