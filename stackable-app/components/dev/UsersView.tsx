"use client";

// =============================================================================
// UsersView - /dev/users. Every user on the platform, server-side paged, with the
// Impersonate action.
//
// URL contract (all optional, defaults are omitted from the URL):
//   /dev/users?q=<text>&role=<role>&schoolId=<school id>&status=<status>&page=<n>&pageSize=<10|25|50>
// e.g. the schools drawer links to /dev/users?schoolId=<id>.
//
// Needs a <Suspense> boundary above it (useSearchParams); see the page file.
// =============================================================================

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, Badge, Button, DataTable, EmptyState, Select } from "@/components/ui";
import { useDevSchools } from "@/hooks/useDevSchools";
import { useDevUsers } from "@/hooks/useDevUsers";
import type { DevUserRow } from "@/lib/dev-types";
import { ErrorPanel } from "./ErrorPanel";
import { formatDate, fullName, ROLE_LABEL, ROLE_OPTIONS, roleLabel, roleTone, statusTone, titleCase, USER_STATUS_OPTIONS } from "./format";
import { ImpersonateDrawer } from "./ImpersonateDrawer";
import { SearchInput } from "./SearchInput";
import { useUrlFilters } from "./useUrlFilters";

type UsersFilters = {
  q: string;
  role: string;
  schoolId: string;
  status: string;
  page: number;
  pageSize: number;
};

const DEFAULTS: UsersFilters = { q: "", role: "", schoolId: "", status: "", page: 1, pageSize: 10 };
const PAGE_SIZES = [10, 25, 50];

/** Reads + sanitises the query string: unknown roles / statuses and junk numbers fall back to the defaults. */
function parseUsersFilters(params: URLSearchParams): UsersFilters {
  const role = params.get("role") ?? "";
  const status = params.get("status") ?? "";
  const page = Number.parseInt(params.get("page") ?? "", 10);
  const pageSize = Number.parseInt(params.get("pageSize") ?? "", 10);
  return {
    q: (params.get("q") ?? "").trim().slice(0, 100),
    role: (ROLE_OPTIONS as readonly string[]).includes(role) ? role : "",
    schoolId: (params.get("schoolId") ?? "").trim().slice(0, 64),
    status: (USER_STATUS_OPTIONS as readonly string[]).includes(status) ? status : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULTS.pageSize,
  };
}

// The API does not sort (see SchoolsView), so no column is sortable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLUMNS: ColumnDef<DevUserRow, any>[] = [
  {
    id: "name",
    header: "User",
    accessorFn: (user) => fullName(user),
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={fullName(row.original)} size="sm" />
        <span className="truncate font-semibold text-ink">{fullName(row.original)}</span>
      </div>
    ),
  },
  {
    id: "email",
    header: "Email",
    accessorFn: (user) => user.email,
    enableSorting: false,
    cell: (cell) => <span className="block max-w-[16rem] truncate">{cell.getValue<string | null>() ?? "-"}</span>,
  },
  {
    id: "role",
    header: "Role",
    accessorFn: (user) => user.role,
    enableSorting: false,
    cell: (cell) => <Badge tone={roleTone(cell.getValue<string>())}>{roleLabel(cell.getValue<string>())}</Badge>,
  },
  {
    id: "school",
    header: "School",
    accessorFn: (user) => user.schoolName ?? user.schoolCode,
    enableSorting: false,
    cell: (cell) => <span className="block max-w-[14rem] truncate">{cell.getValue<string>()}</span>,
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (user) => user.status,
    enableSorting: false,
    cell: (cell) => (
      <Badge tone={statusTone(cell.getValue<string>())} dot>
        {titleCase(cell.getValue<string>())}
      </Badge>
    ),
  },
  {
    id: "created",
    header: "Created",
    accessorFn: (user) => user.createdAt,
    enableSorting: false,
    meta: { className: "whitespace-nowrap" },
    cell: (cell) => formatDate(cell.getValue<string>()),
  },
];

export function UsersView() {
  const { filters, update } = useUrlFilters(parseUsersFilters, DEFAULTS);
  const users = useDevUsers(filters);

  // School filter options (first 100 schools, newest data wins on refetch).
  const schools = useDevSchools({ pageSize: 100 });
  const schoolOptions = schools.data?.items ?? [];
  const schoolKnown = !filters.schoolId || schoolOptions.some((school) => school.id === filters.schoolId);

  // Impersonate drawer. `session` becomes the drawer's key so each opening starts clean.
  const [target, setTarget] = useState<DevUserRow | null>(null);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  const filtered = Boolean(filters.q || filters.role || filters.schoolId || filters.status);
  const clearFilters = () => update({ q: "", role: "", schoolId: "", status: "", page: 1 });

  return (
    <div className="animate-fade-up">
      <DataTable<DevUserRow>
        manual
        searchable={false}
        columns={COLUMNS}
        data={users.data?.items ?? []}
        total={users.data?.total}
        loading={users.isPending}
        page={filters.page}
        onPageChange={(page) => update({ page })}
        pageSize={filters.pageSize}
        onPageSizeChange={(pageSize) => update({ pageSize, page: 1 })}
        caption="Users across all schools"
        getRowId={(user) => user.id}
        className={users.isPlaceholderData ? "opacity-70 transition-opacity duration-300" : "transition-opacity duration-300"}
        filters={
          <>
            <SearchInput
              value={filters.q}
              onCommit={(q) => update({ q, page: 1 })}
              placeholder="Search name or email"
              className="w-full sm:w-64"
            />
            <Select
              pill
              aria-label="Filter by role"
              value={filters.role}
              onChange={(event) => update({ role: event.target.value, page: 1 })}
              className="w-full sm:w-36"
            >
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </Select>
            <Select
              pill
              aria-label="Filter by school"
              value={filters.schoolId}
              onChange={(event) => update({ schoolId: event.target.value, page: 1 })}
              className="w-full sm:w-48"
            >
              <option value="">All schools</option>
              {schoolKnown ? null : <option value={filters.schoolId}>Selected school</option>}
              {schoolOptions.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </Select>
            <Select
              pill
              aria-label="Filter by status"
              value={filters.status}
              onChange={(event) => update({ status: event.target.value, page: 1 })}
              className="w-full sm:w-36"
            >
              <option value="">All statuses</option>
              {USER_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {titleCase(status)}
                </option>
              ))}
            </Select>
            {filtered ? (
              <Button variant="ghost" size="sm" leftIcon="solar:close-circle-linear" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </>
        }
        toolbar={
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            leftIcon="solar:refresh-linear"
            aria-label="Refresh users"
            loading={users.isFetching}
            onClick={() => void users.refetch()}
          />
        }
        rowActions={(user) =>
          // A super-admin can never be impersonated (the server refuses too).
          user.role === "super-admin" ? null : (
            <Button
              size="sm"
              variant="secondary"
              leftIcon="solar:eye-linear"
              aria-label={`Impersonate ${fullName(user)}`}
              onClick={() => {
                setTarget(user);
                setSession((current) => current + 1);
                setOpen(true);
              }}
            >
              Impersonate
            </Button>
          )
        }
        emptyState={
          users.isError ? (
            <ErrorPanel error={users.error} onRetry={() => void users.refetch()} retrying={users.isFetching} />
          ) : (
            <EmptyState
              icon="solar:users-group-two-rounded-linear"
              title={filtered ? "No users match these filters" : "No users yet"}
              description={filtered ? "Try a wider search or clear the filters." : "Accounts appear here as schools add people."}
              action={
                filtered ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )
        }
      />

      <ImpersonateDrawer key={session} user={target} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
