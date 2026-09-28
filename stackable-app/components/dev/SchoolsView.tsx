"use client";

// =============================================================================
// SchoolsView - /dev/schools. Server-side table (search + paging); a row opens the
// detail drawer. Search and paging are local state here; the Users page is the one
// with URL-synced filters.
// =============================================================================

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge, Button, DataTable, EmptyState } from "@/components/ui";
import { useDevSchools } from "@/hooks/useDevSchools";
import type { DevSchoolRow } from "@/lib/dev-types";
import { ErrorPanel } from "./ErrorPanel";
import { formatDate, statusTone, titleCase } from "./format";
import { SchoolDrawer } from "./SchoolDrawer";

// Sorting is not part of the API contract (the server orders the rows), so every
// column opts out; a header that looked sortable but did nothing would be a lie.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLUMNS: ColumnDef<DevSchoolRow, any>[] = [
  {
    id: "name",
    header: "School",
    accessorFn: (school) => school.name,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink">{row.original.name}</p>
        <p className="truncate text-xs text-muted">{row.original.location ?? row.original.email ?? "No location set"}</p>
      </div>
    ),
  },
  {
    id: "code",
    header: "Code",
    accessorFn: (school) => school.code,
    enableSorting: false,
    cell: (cell) => <span className="font-mono text-xs text-ink-soft">{cell.getValue<string>()}</span>,
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (school) => school.status,
    enableSorting: false,
    cell: (cell) => (
      <Badge tone={statusTone(cell.getValue<string>())} dot>
        {titleCase(cell.getValue<string>())}
      </Badge>
    ),
  },
  {
    id: "package",
    header: "Package",
    accessorFn: (school) => school.subscriptionPackage,
    enableSorting: false,
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-ink">{titleCase(row.original.subscriptionPackage)}</p>
        <p className="text-xs text-muted">{titleCase(row.original.subscriptionStatus)}</p>
      </div>
    ),
  },
  {
    id: "users",
    header: "Users",
    accessorFn: (school) => school.userCount,
    enableSorting: false,
    meta: { align: "right", className: "tabular-nums" },
    cell: (cell) => cell.getValue<number>().toLocaleString("en-US"),
  },
  {
    id: "students",
    header: "Students",
    accessorFn: (school) => school.studentCount,
    enableSorting: false,
    meta: { align: "right", className: "tabular-nums" },
    cell: (cell) => cell.getValue<number>().toLocaleString("en-US"),
  },
  {
    id: "created",
    header: "Created",
    accessorFn: (school) => school.createdAt,
    enableSorting: false,
    meta: { className: "whitespace-nowrap" },
    cell: (cell) => formatDate(cell.getValue<string>()),
  },
];

export function SchoolsView() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // `selected` outlives `open` so the drawer keeps its content while it slides out.
  const [selected, setSelected] = useState<DevSchoolRow | null>(null);
  const [open, setOpen] = useState(false);

  const schools = useDevSchools({ q, page, pageSize });

  return (
    <div className="animate-fade-up">
      <DataTable<DevSchoolRow>
        manual
        columns={COLUMNS}
        data={schools.data?.items ?? []}
        total={schools.data?.total}
        loading={schools.isPending}
        page={page}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        onSearchChange={(value) => setQ(value.trim())}
        searchPlaceholder="Search schools by name or code"
        caption="Schools on the platform"
        getRowId={(school) => school.id}
        onRowClick={(school) => {
          setSelected(school);
          setOpen(true);
        }}
        className={schools.isPlaceholderData ? "opacity-70 transition-opacity duration-300" : "transition-opacity duration-300"}
        toolbar={
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            leftIcon="solar:refresh-linear"
            aria-label="Refresh schools"
            loading={schools.isFetching}
            onClick={() => void schools.refetch()}
          />
        }
        emptyState={
          schools.isError ? (
            <ErrorPanel error={schools.error} onRetry={() => void schools.refetch()} retrying={schools.isFetching} />
          ) : (
            <EmptyState
              icon="solar:buildings-2-linear"
              title={q ? "No schools match your search" : "No schools yet"}
              description={q ? "Try a different name or school code." : "Schools appear here as soon as they are created."}
            />
          )
        }
      />

      <SchoolDrawer school={selected} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
