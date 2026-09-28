"use client";

/**
 * Students (/dashboard/students) - the school's student register: search /
 * filter, list or grid view, quick suspend / activate, edit and delete.
 *
 * This page only orchestrates; the pieces live in components/admin/students/**
 * and the data layer in hooks/useStudents.ts (TanStack Query, Prisma-backed -
 * the direct Supabase browser client this page used to import is gone).
 *
 * The dashboard navbar already renders the page <h1>, so this header has none.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import { Button, EmptyState, Tabs } from "@/components/ui";
import { useStudents, type StudentListItem } from "@/hooks/useStudents";
import { StudentDrawer } from "@/components/admin/students/StudentDrawer";
import { StudentFilters } from "@/components/admin/students/StudentFilters";
import { StudentsGrid } from "@/components/admin/students/StudentsGrid";
import { StudentsTable } from "@/components/admin/students/StudentsTable";
import { useStudentActions } from "@/components/admin/students/useStudentActions";
import { EMPTY_FILTERS, filterStudents, hasActiveFilters, type StudentFilterState } from "@/components/admin/students/utils";

type ViewMode = "list" | "grid";

const DEFAULT_SORTING: SortingState = [{ id: "student", desc: false }];

export default function StudentsPage() {
  const router = useRouter();
  const studentsQuery = useStudents();
  const actions = useStudentActions();

  const students: StudentListItem[] = studentsQuery.data?.students ?? [];
  const classes = studentsQuery.data?.classes ?? [];

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filters, setFilters] = useState<StudentFilterState>(EMPTY_FILTERS);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pageSize, setPageSize] = useState(10);
  const [edit, setEdit] = useState<{ student: StudentListItem | null; open: boolean; n: number }>({
    student: null,
    open: false,
    n: 0,
  });

  const filtered = filterStudents(students, filters, classes);

  function openProfile(student: StudentListItem) {
    router.push(`/dashboard/students/${student.id}`);
  }

  function openEdit(student: StudentListItem) {
    setEdit((current) => ({ student, open: true, n: current.n + 1 }));
  }

  const emptyState = hasActiveFilters(filters) ? (
    <EmptyState
      icon="solar:users-group-rounded-linear"
      title="No students found"
      description="Your current filters returned no student records."
      action={
        <Button variant="secondary" leftIcon="solar:restart-linear" onClick={() => setFilters(EMPTY_FILTERS)}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon="solar:users-group-rounded-linear"
      title="No students yet"
      description="Students enrolled at your school will show up here."
    />
  );

  const errorState = (
    <EmptyState
      icon="solar:danger-triangle-linear"
      title="Students could not be loaded"
      description={studentsQuery.error instanceof Error ? studentsQuery.error.message : "Failed to fetch students."}
      action={
        <Button variant="secondary" leftIcon="solar:refresh-linear" onClick={() => void studentsQuery.refetch()}>
          Try again
        </Button>
      }
    />
  );

  // Filters remount the list / grid so paging starts from page 1 again.
  const resetKey = JSON.stringify(filters);

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
          Student register, quick actions, filtering and full profiles for every learner at your school.
        </p>
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
      </div>

      <StudentFilters value={filters} onChange={setFilters} classes={classes} shown={filtered.length} total={students.length} />

      {studentsQuery.isError ? (
        <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">{errorState}</div>
      ) : viewMode === "list" ? (
        <StudentsTable
          key={resetKey}
          students={filtered}
          classes={classes}
          loading={studentsQuery.isLoading}
          emptyState={emptyState}
          sorting={sorting}
          onSortingChange={setSorting}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          busyId={actions.busyId}
          onView={openProfile}
          onEdit={openEdit}
          onToggleStatus={(student) => void actions.toggleStatus(student)}
          onDelete={(student) => void actions.deleteStudent(student)}
        />
      ) : (
        <StudentsGrid
          key={resetKey}
          students={filtered}
          classes={classes}
          loading={studentsQuery.isLoading}
          sorting={sorting}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          busyId={actions.busyId}
          onView={openProfile}
          onEdit={openEdit}
          onToggleStatus={(student) => void actions.toggleStatus(student)}
          onDelete={(student) => void actions.deleteStudent(student)}
          emptyState={emptyState}
        />
      )}

      {edit.student ? (
        <StudentDrawer
          key={`${edit.student.id}-${edit.n}`}
          student={edit.student}
          open={edit.open}
          onClose={() => setEdit((current) => ({ ...current, open: false }))}
          classes={classes}
          actions={actions}
        />
      ) : null}
    </div>
  );
}
