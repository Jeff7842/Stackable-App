"use client";

// =============================================================================
// Users & permissions (/dashboard/admin-role)
// -----------------------------------------------------------------------------
// A small orchestrating page: data comes from hooks/useAdminUsers.ts, the
// pieces live in components/admin/users/**. The shell already renders the page
// <h1>, so this page has none of its own.
//
// Who can do what (the API is the real enforcement point):
//   - list / create / edit: admin and super-admin (a manager gets a 403 and sees
//     the "restricted" state below)
//   - delete: super-admin only (the button is hidden for everyone else)
// =============================================================================

import { useEffect, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import { useToast } from "@/components/toast/ToastProvider";
import { Button, EmptyState } from "@/components/ui";
import { CreateUserDrawer } from "@/components/admin/users/CreateUserDrawer";
import { EMPTY_FILTERS, UserFilters, hasActiveFilters, type UserFilterState } from "@/components/admin/users/UserFilters";
import { UserDrawer } from "@/components/admin/users/UserDrawer";
import { UsersTable } from "@/components/admin/users/UsersTable";
import { useUserActions } from "@/components/admin/users/useUserActions";
import { useAdminSchoolOptions, useAdminUsers, type AdminUser } from "@/hooks/useAdminUsers";
import { useMe } from "@/hooks/useMe";

// Newest first, same as the old default. Header clicks change it.
const DEFAULT_SORTING: SortingState = [{ id: "joined", desc: true }];

export default function UsersPage() {
  const { showToast } = useToast();
  const me = useMe();
  const actions = useUserActions();

  const [filters, setFilters] = useState<UserFilterState>(EMPTY_FILTERS);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  // `n` bumps on every open so each drawer starts from a fresh snapshot / empty form.
  const [detail, setDetail] = useState<{ user: AdminUser | null; open: boolean; n: number }>({ user: null, open: false, n: 0 });
  const [create, setCreate] = useState({ open: false, n: 0 });

  const users = useAdminUsers(filters);
  const schools = useAdminSchoolOptions();

  const rows = users.data?.users ?? [];
  const pageKeys = users.data?.pageKeys ?? [];
  const forbidden = users.error?.status === 403;
  const isSuperAdmin = me.data?.role === "super-admin";
  const viewer = { id: me.data?.id, role: me.data?.role };

  // Same load-failure toasts as before (the inline states below are the main feedback).
  const usersError = users.error;
  const schoolsError = schools.error;
  useEffect(() => {
    if (usersError && usersError.status !== 403) {
      showToast({ type: "error", title: "Users load failed", description: usersError.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showToast is not stable; toast once per error
  }, [usersError]);
  useEffect(() => {
    if (schoolsError && schoolsError.status !== 403) {
      showToast({ type: "error", title: "Schools load failed", description: schoolsError.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [schoolsError]);

  const openUser = (user: AdminUser) => setDetail((d) => ({ user, open: true, n: d.n + 1 }));
  const openCreate = () => setCreate((c) => ({ open: true, n: c.n + 1 }));

  if (forbidden) {
    return (
      <EmptyState
        className="mt-6 rounded-2xl bg-surface shadow-soft ring-1 ring-ghost"
        icon="solar:lock-keyhole-linear"
        title="User management is restricted"
        description="Only admins and super-admins can manage users and page permissions. Ask an admin if you need a change."
      />
    );
  }

  // Shown instead of the empty table: a load error, "nothing matches", or "no users yet".
  let emptyState;
  if (users.isError && !users.data) {
    emptyState = (
      <EmptyState
        icon="solar:danger-triangle-linear"
        title="Couldn't load users"
        description={users.error?.message}
        action={
          <Button variant="secondary" leftIcon="solar:refresh-linear" loading={users.isFetching} onClick={() => void users.refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else if (rows.length === 0 && !users.isPending) {
    emptyState = hasActiveFilters(filters) ? (
      <EmptyState
        icon="solar:users-group-rounded-linear"
        title="No users found"
        description="Your current filters returned no user records."
        action={
          <Button variant="secondary" leftIcon="solar:restart-linear" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon="solar:users-group-rounded-linear"
        title="No users yet"
        description="Add the first user to get started."
        action={
          <Button leftIcon="solar:add-circle-linear" onClick={openCreate}>
            Add user
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
          Central user register for managers, admins, super-admins, teachers and students.
        </p>
        <Button leftIcon="solar:add-circle-linear" onClick={openCreate}>
          Add user
        </Button>
      </div>

      <UsersTable
        users={rows}
        loading={users.isPending}
        filters={<UserFilters value={filters} onChange={setFilters} schools={schools.data?.schools ?? []} />}
        emptyState={emptyState}
        sorting={sorting}
        onSortingChange={setSorting}
        canDelete={isSuperAdmin}
        viewer={viewer}
        busyId={actions.busyId}
        onOpen={openUser}
        onToggleSuspend={(user) => void actions.toggleSuspend(user)}
        onDelete={(user) => void actions.deleteUser(user)}
      />

      {detail.user ? (
        <UserDrawer
          key={`${detail.user.id}-${detail.n}`}
          user={detail.user}
          open={detail.open}
          onClose={() => setDetail((d) => ({ ...d, open: false }))}
          pageKeys={pageKeys}
          viewer={viewer}
          canDelete={isSuperAdmin}
        />
      ) : null}

      {create.n > 0 ? (
        <CreateUserDrawer
          key={create.n}
          open={create.open}
          onClose={() => setCreate((c) => ({ ...c, open: false }))}
          schools={schools.data?.schools ?? []}
          schoolsLoading={schools.isPending}
          pageKeys={pageKeys}
          canGrantSuperAdmin={isSuperAdmin}
        />
      ) : null}
    </div>
  );
}
