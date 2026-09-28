"use client";

/**
 * Schools (/dashboard/schools) - school portfolio, subscription health,
 * capacity utilisation and high-risk actions.
 *
 * This page only orchestrates; the pieces live in components/admin/schools/**
 * and the data layer in hooks/useSchools.ts (TanStack Query, no raw fetch).
 *   SchoolFilters  search + filters + sort (shared by both views)
 *   SchoolsTable   list view (DataTable)      SchoolsGrid   card view
 *   SchoolDrawer   detail with tabs           SchoolForm    create / edit drawer
 *   useSchoolActions  confirm -> mutate -> toast for suspend, capacity, code, delete, PDF
 *
 * The dashboard navbar already renders the page <h1>, so this header has none.
 */
import { useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import { Button, EmptyState, Tabs } from "@/components/ui";
import { useMe } from "@/hooks/useMe";
import { useSchools, type SchoolRow } from "@/hooks/useSchools";
import { HttpError } from "@/lib/api/http";
import { useToast } from "@/components/toast/ToastProvider";
import { SchoolDrawer } from "@/components/admin/schools/SchoolDrawer";
import { SchoolFilters } from "@/components/admin/schools/SchoolFilters";
import { SchoolForm } from "@/components/admin/schools/SchoolForm";
import { SchoolsGrid } from "@/components/admin/schools/SchoolsGrid";
import { SchoolsTable } from "@/components/admin/schools/SchoolsTable";
import type { FormMode } from "@/components/admin/schools/formState";
import { schoolPermissions } from "@/components/admin/schools/permissions";
import { useErrorToast } from "@/components/admin/schools/useErrorToast";
import { useSchoolActions } from "@/components/admin/schools/useSchoolActions";
import {
  DEFAULT_SORTING,
  EMPTY_FILTERS,
  SORT_OPTIONS,
  filterSchools,
  hasActiveFilters,
  sortingToOption,
  type SchoolFilters as Filters,
} from "@/components/admin/schools/utils";

type ViewMode = "list" | "grid";

/** The create / edit drawer. `nonce` remounts the form so every open starts clean. */
type FormState = { open: boolean; mode: FormMode; schoolId?: string; nonce: number };

export default function SchoolsPage() {
  const { showToast } = useToast();
  const me = useMe();
  const permissions = schoolPermissions(me.data?.role);

  const schoolsQuery = useSchools();
  useErrorToast(schoolsQuery.error, "Schools load failed", "Failed to fetch schools.");
  const schools: SchoolRow[] = schoolsQuery.data?.data ?? [];

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pageSize, setPageSize] = useState(10);
  const [capacityColumns, setCapacityColumns] = useState(false);

  // Detail drawer: the id is kept after closing so the exit animation still shows the content.
  const [detail, setDetail] = useState<{ id: string | null; open: boolean }>({ id: null, open: false });
  const [form, setForm] = useState<FormState | null>(null);

  const actions = useSchoolActions({
    onDeleted: (id) => setDetail((current) => (current.id === id ? { ...current, open: false } : current)),
  });

  const filtered = filterSchools(schools, filters);
  const packages = Array.from(new Set(schools.map((school) => school.subscription_package))).sort();

  function openDetails(school: SchoolRow) {
    if (!school.id) {
      showToast({
        type: "error",
        title: "Missing school id",
        description: "This school record has no id. Fix the school_usage_overview view.",
      });
      return;
    }
    setDetail({ id: school.id, open: true });
  }

  function openForm(mode: FormMode, schoolId?: string) {
    setForm((current) => ({ open: true, mode, schoolId, nonce: (current?.nonce ?? 0) + 1 }));
  }

  function openEdit(school: SchoolRow) {
    if (!school.id) return openDetails(school); // shows the "missing id" toast
    openForm("edit", school.id);
  }

  function openCreate() {
    setDetail((current) => ({ ...current, open: false }));
    openForm("create");
  }

  const noAccess = schoolsQuery.error instanceof HttpError && schoolsQuery.error.status === 403;

  const emptyState = hasActiveFilters(filters) ? (
    <EmptyState
      icon="solar:buildings-2-linear"
      title="No schools found"
      description="Your current filters returned no school records."
      action={
        <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon="solar:buildings-2-linear"
      title="No schools yet"
      description="Schools you add will show up here with their subscription and capacity."
      action={
        permissions.canWrite ? (
          <Button leftIcon="solar:add-circle-linear" onClick={openCreate}>
            Add school
          </Button>
        ) : undefined
      }
    />
  );

  // Filters remount the list / grid so paging starts from page 1 again.
  const resetKey = JSON.stringify(filters);

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
          School portfolio, subscription health, capacity utilisation and high-risk actions.
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
          {permissions.canWrite ? (
            <Button leftIcon="solar:add-circle-linear" onClick={openCreate}>
              Add school
            </Button>
          ) : null}
        </div>
      </div>

      {noAccess ? (
        <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
          <EmptyState
            icon="solar:shield-keyhole-linear"
            title="You do not have access to schools"
            description="Your role cannot view the school portfolio. Ask a school admin or a platform super-admin if you need it."
          />
        </div>
      ) : (
        <>
          <SchoolFilters
            filters={filters}
            onChange={setFilters}
            packages={packages}
            sortValue={sortingToOption(sorting)}
            onSortChange={(value) => {
              const option = SORT_OPTIONS.find((o) => o.value === value);
              if (option) setSorting(option.sorting);
            }}
            showCapacityToggle={viewMode === "list"}
            capacityColumns={capacityColumns}
            onToggleCapacityColumns={() => setCapacityColumns((on) => !on)}
            shown={filtered.length}
            total={schools.length}
          />

          {schoolsQuery.isError ? (
            <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
              <EmptyState
                icon="solar:danger-triangle-linear"
                title="Schools could not be loaded"
                description={
                  schoolsQuery.error instanceof Error ? schoolsQuery.error.message : "Failed to fetch schools."
                }
                action={
                  <Button variant="secondary" leftIcon="solar:refresh-linear" onClick={() => void schoolsQuery.refetch()}>
                    Try again
                  </Button>
                }
              />
            </div>
          ) : viewMode === "list" ? (
            <SchoolsTable
              key={resetKey}
              schools={filtered}
              loading={schoolsQuery.isLoading}
              sorting={sorting}
              onSortingChange={setSorting}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              capacityColumns={capacityColumns}
              permissions={permissions}
              actions={actions}
              onView={openDetails}
              onEdit={openEdit}
              emptyState={emptyState}
            />
          ) : (
            <SchoolsGrid
              key={resetKey}
              schools={filtered}
              loading={schoolsQuery.isLoading}
              sorting={sorting}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              permissions={permissions}
              actions={actions}
              onView={openDetails}
              onEdit={openEdit}
              emptyState={emptyState}
            />
          )}
        </>
      )}

      <SchoolDrawer
        open={detail.open}
        schoolId={detail.id}
        onClose={() => setDetail((current) => ({ ...current, open: false }))}
        onEdit={(id) => openForm("edit", id)}
        permissions={permissions}
        actions={actions}
      />

      {form ? (
        <SchoolForm
          key={form.nonce}
          open={form.open}
          mode={form.mode}
          schoolId={form.schoolId}
          onClose={() => setForm((current) => (current ? { ...current, open: false } : current))}
          permissions={permissions}
          actions={actions}
        />
      ) : null}
    </div>
  );
}
