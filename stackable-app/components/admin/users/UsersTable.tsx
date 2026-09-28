"use client";

// The users list: the shared DataTable with the user columns, the filters in
// its toolbar slot and the row actions. Sorting / paging / search run in the
// browser (the API returns the whole filtered list, as it always did).

import type { ReactNode } from "react";
import { createColumnHelper, type OnChangeFn, type SortingState } from "@tanstack/react-table";
import { Avatar, DataTable } from "@/components/ui";
import type { AdminUser } from "@/hooks/useAdminUsers";
import { PasswordBadge, RoleBadge, StatusBadge } from "./Badges";
import { RowActions } from "./RowActions";
import { accessRules, formatDate, getFullName, type Viewer } from "./userUtils";

const col = createColumnHelper<AdminUser>();
const dash = <span className="text-muted">—</span>;

// Every accessor returns a string so the table's built-in search can read it
// (name, email, phone(s), school and role are all searchable, like the old page).
const columns = [
  col.accessor((u) => getFullName(u), {
    id: "user",
    header: "User",
    cell: ({ row }) => {
      const name = getFullName(row.original);
      return (
        <div className="flex items-center gap-3">
          <Avatar name={name} size="sm" />
          <span className="font-semibold text-ink">{name}</span>
        </div>
      );
    },
  }),
  col.accessor((u) => u.schools?.name ?? "", {
    id: "school",
    header: "School",
    cell: (c) => c.getValue() || dash,
  }),
  col.accessor((u) => u.role, {
    id: "role",
    header: "Role",
    cell: ({ row }) => <RoleBadge role={row.original.role} />,
  }),
  col.accessor((u) => u.email ?? "", {
    id: "email",
    header: "Email",
    cell: (c) => c.getValue() || dash,
  }),
  col.accessor((u) => [u.phone, u.phone_2].filter(Boolean).join(" "), {
    id: "phone",
    header: "Phone",
    meta: { className: "tabular-nums whitespace-nowrap" },
    cell: ({ row }) => {
      const { phone, phone_2 } = row.original;
      if (!phone && !phone_2) return dash;
      return (
        <div>
          <div>{phone ?? phone_2}</div>
          {phone && phone_2 ? <div className="text-xs text-muted">{phone_2}</div> : null}
        </div>
      );
    },
  }),
  col.accessor((u) => u.status, {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  }),
  col.accessor((u) => (u.must_change_password ? "Required" : "Cleared"), {
    id: "password",
    header: "Password change",
    cell: ({ row }) => <PasswordBadge required={row.original.must_change_password} />,
  }),
  col.accessor((u) => u.created_at, {
    id: "joined",
    header: "Joined",
    meta: { className: "tabular-nums whitespace-nowrap" },
    cell: (c) => formatDate(c.getValue()),
  }),
];

export interface UsersTableProps {
  users: AdminUser[];
  loading: boolean;
  filters: ReactNode;
  emptyState: ReactNode;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  canDelete: boolean;
  viewer: Viewer;
  busyId: string | null;
  onOpen: (user: AdminUser) => void;
  onToggleSuspend: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}

export function UsersTable({
  users,
  loading,
  filters,
  emptyState,
  sorting,
  onSortingChange,
  canDelete,
  viewer,
  busyId,
  onOpen,
  onToggleSuspend,
  onDelete,
}: UsersTableProps) {
  "use no memo"; // TanStack Table + React Compiler (see DataTable)

  return (
    <DataTable<AdminUser>
      columns={columns}
      data={users}
      loading={loading}
      caption="Users"
      getRowId={(u) => u.id}
      searchPlaceholder="Search name, email, school, phone or role"
      pageSizeOptions={[10, 20, 50]}
      filters={filters}
      emptyState={emptyState}
      sorting={sorting}
      onSortingChange={onSortingChange}
      onRowClick={onOpen}
      rowActions={(user) => (
        <RowActions
          user={user}
          canDelete={canDelete}
          locked={accessRules(user, viewer).lockAccess}
          busy={busyId === user.id}
          onOpen={onOpen}
          onToggleSuspend={onToggleSuspend}
          onDelete={onDelete}
        />
      )}
    />
  );
}

export default UsersTable;
