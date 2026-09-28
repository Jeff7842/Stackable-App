"use client";

/**
 * SchoolsTable - the list view, built on the shared DataTable.
 *
 * Filtering happens upstream (SchoolFilters) so the grid shows the same rows;
 * this component gets the already-filtered array and only sorts (controlled,
 * so the "Sort by" select and the header clicks stay in sync) and pages.
 *
 * Columns: School, Head / owner, Contact, Package, Users capacity, School code,
 * status, subscription, expiry, plus - behind the "Capacity columns" toggle -
 * Students, Parents, Teachers, Admins and Staff capacity.
 */
import { useMemo, type ReactNode } from "react";
import type { ColumnDef, OnChangeFn, SortingState } from "@tanstack/react-table";
import { Avatar, Button, DataTable } from "@/components/ui";
import type { SchoolRow } from "@/hooks/useSchools";
import { CapacityCell } from "./CapacityMeter";
import { SchoolActionsMenu } from "./SchoolActionsMenu";
import { SchoolStatusBadge, SubscriptionStatusBadge } from "./StatusBadge";
import type { SchoolPermissions } from "./permissions";
import type { SchoolActions } from "./useSchoolActions";
import { CAPACITY_FIELDS, MAX_CODE_CHANGES, expiryHint, formatDate } from "./utils";

export interface SchoolsTableProps {
  /** Already filtered rows. */
  schools: SchoolRow[];
  loading: boolean;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  capacityColumns: boolean;
  permissions: SchoolPermissions;
  actions: SchoolActions;
  onView: (school: SchoolRow) => void;
  onEdit: (school: SchoolRow) => void;
  emptyState: ReactNode;
}

/** Two stacked lines: a strong value and a quiet caption. */
function TwoLine({ top, bottom }: { top: ReactNode; bottom?: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="font-medium text-ink">{top}</div>
      {bottom ? <div className="text-xs text-muted">{bottom}</div> : null}
    </div>
  );
}

const DASH = <span className="text-muted">—</span>;

export function SchoolsTable({
  schools,
  loading,
  sorting,
  onSortingChange,
  pageSize,
  onPageSizeChange,
  capacityColumns,
  permissions,
  actions,
  onView,
  onEdit,
  emptyState,
}: SchoolsTableProps) {
  // TanStack Table returns objects the React Compiler cannot track.
  "use no memo";

  const columns = useMemo<ColumnDef<SchoolRow, unknown>[]>(() => {
    const capacity: ColumnDef<SchoolRow, unknown>[] = CAPACITY_FIELDS.map((field) => ({
      id: field.id,
      header: field.label,
      accessorFn: (school) => school[field.actual],
      enableSorting: field.id === "users",
      cell: ({ row }) => <CapacityCell actual={row.original[field.actual]} expected={row.original[field.expected]} />,
    }));
    const [users, ...breakdown] = capacity;

    return [
      {
        id: "name",
        header: "School",
        accessorFn: (school) => school.name,
        cell: ({ row }) => {
          const school = row.original;
          return (
            <div className="flex min-w-[15rem] items-center gap-3">
              <Avatar name={school.name} src={school.logo} size="md" />
              <div className="min-w-0">
                <p className="max-w-[18rem] font-semibold break-words text-ink">{school.name}</p>
                <p className="text-xs text-muted tabular-nums">#{school.school_id}</p>
              </div>
            </div>
          );
        },
      },
      {
        id: "leadership",
        header: "Head / owner",
        enableSorting: false,
        cell: ({ row }) => <TwoLine top={row.original.head_name || DASH} bottom={row.original.owner_name || "—"} />,
      },
      {
        id: "contact",
        header: "Contact",
        enableSorting: false,
        cell: ({ row }) => (
          <TwoLine
            top={<span className="block max-w-[14rem] truncate" title={row.original.email ?? undefined}>{row.original.email || DASH}</span>}
            bottom={row.original.phone_1 || "—"}
          />
        ),
      },
      {
        id: "package",
        header: "Package",
        enableSorting: false,
        cell: ({ row }) => (
          <TwoLine top={row.original.subscription_package} bottom={formatDate(row.original.subscription_started_at)} />
        ),
      },
      users,
      ...(capacityColumns ? breakdown : []),
      {
        id: "code",
        header: "School code",
        enableSorting: false,
        cell: ({ row }) => {
          const school = row.original;
          return (
            <div className="space-y-0.5">
              <p className="font-semibold tracking-wide whitespace-nowrap text-ink tabular-nums">{school.code}</p>
              <p className="text-xs text-muted tabular-nums">
                Changes {school.code_change_count}/{MAX_CODE_CHANGES}
              </p>
              {school.pending_code_change_at ? (
                <p className="text-[11px] font-medium text-info">code queued {formatDate(school.pending_code_change_at)}</p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="space-y-1">
            <SchoolStatusBadge status={row.original.status} />
            {row.original.pending_status_change_at ? (
              <p className="text-[11px] font-medium text-warning">queued {formatDate(row.original.pending_status_change_at)}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: "subscription",
        header: "Subscription",
        enableSorting: false,
        cell: ({ row }) => <SubscriptionStatusBadge status={row.original.subscription_status} />,
      },
      {
        id: "expiry",
        header: "Expiry",
        // Missing dates compare as "" so they come first when ascending (as before).
        accessorFn: (school) => school.subscription_expires_at ?? "",
        sortingFn: "basic",
        cell: ({ row }) => {
          const hint = expiryHint(row.original.subscription_expires_at);
          return (
            <div className="space-y-0.5">
              <p className="font-medium whitespace-nowrap text-ink">{formatDate(row.original.subscription_expires_at)}</p>
              {hint ? (
                <p className={hint.tone === "danger" ? "text-[11px] font-medium text-danger" : "text-[11px] font-medium text-warning"}>
                  {hint.text}
                </p>
              ) : null}
            </div>
          );
        },
      },
    ];
  }, [capacityColumns]);

  return (
    <DataTable<SchoolRow>
      columns={columns}
      data={schools}
      loading={loading}
      searchable={false}
      caption="Schools"
      getRowId={(school) => school.id || `school-${school.school_id}`}
      pageSize={pageSize}
      pageSizeOptions={[10, 20, 50]}
      onPageSizeChange={onPageSizeChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      onRowClick={onView}
      emptyState={emptyState}
      rowActions={(school) => (
        <div className="flex items-center justify-end gap-0.5">
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
          <SchoolActionsMenu
            school={school}
            permissions={permissions}
            actions={actions}
            onView={onView}
            onEdit={onEdit}
          />
        </div>
      )}
    />
  );
}
