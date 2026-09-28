// =============================================================================
// useAdminUsers — data layer for the "Users & permissions" page
// (/dashboard/admin-role). Wraps GET/POST/PATCH/DELETE /api/admin/users and
// GET /api/admin/schools with TanStack Query.
// -----------------------------------------------------------------------------
// The API routes are consumed exactly as they are today:
//   GET    /api/admin/users?search&role&status&schoolId -> { users, pageKeys }
//   POST   /api/admin/users                              -> { user }        (201)
//   PATCH  /api/admin/users   (body carries `id`)        -> { ok: true }
//   DELETE /api/admin/users?id=                          -> { ok: true }    (super-admin only)
//   GET    /api/admin/schools                            -> { schools }
//
// Toasts / confirmations are NOT done here: the page / component layer shows
// them (useToast, useConfirmation). Mutations only move data and keep the cache
// honest: they patch the cached rows right away (snappy UI) and invalidate
// qk.users.all so the server has the last word.
// =============================================================================

"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiGet, apiSend, HttpError } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { Role, UserStatus } from "@/lib/validation/shared";

/* ----------------------------------------------------------------------------
 * Types (exported so pages / components never re-declare the API shapes)
 * -------------------------------------------------------------------------- */

/** One page-permission row. A page with NO row is allowed (see lib/api/guard.ts). */
export type AdminUserPermission = { page_key: string; can_access: boolean };

export type AdminUserSchool = { id: string; name: string; code?: string };

/** A user as returned by GET /api/admin/users. */
export type AdminUser = {
  id: string;
  created_at: string;
  updated_at: string;
  school_id: string;
  school_code: string;
  school_adm: number | null;
  email: string | null;
  phone: number | null;
  phone_2: number | null;
  role: Role;
  status: UserStatus;
  first_name: string;
  last_name: string;
  must_change_password: boolean;
  schools?: AdminUserSchool | null;
  permissions?: AdminUserPermission[];
};

export type AdminUsersResponse = { users: AdminUser[]; pageKeys: string[] };

/** Query-string filters accepted by GET /api/admin/users. "all" / empty = no filter. */
export type AdminUserFilters = {
  search?: string;
  role?: Role | "all";
  status?: UserStatus | "all";
  schoolId?: string | "all";
};

/** Roles the API accepts on POST / PATCH (ALLOWED_ROLES in the route). */
export const ASSIGNABLE_ROLES = ["manager", "admin", "super-admin", "teacher", "student"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type CreateAdminUserInput = {
  first_name: string;
  last_name: string;
  school_id: string;
  role: AssignableRole;
  email?: string;
  phone?: string;
  phone_2?: string;
  photo_url?: string;
  permissions?: AdminUserPermission[];
};
export type CreateAdminUserResponse = { user: Omit<AdminUser, "permissions"> };

/**
 * PATCH body. Only `id` is required; send just what changed.
 * NOTE: the route always runs `update(...)` on the users row, so callers should
 * include at least one users column (status / must_change_password) even for a
 * permissions-only or clear_history-only request (see UserDrawer / useUserActions).
 */
export type UpdateAdminUserInput = {
  id: string;
  email?: string | null;
  status?: UserStatus;
  role?: AssignableRole;
  must_change_password?: boolean;
  /** Replaces ALL of the user's permission rows. */
  permissions?: AdminUserPermission[];
  /** Deletes the user's activity log, login history and notifications. */
  clear_history?: boolean;
};

export type AdminOkResponse = { ok: true };

export type AdminSchoolOption = { id: string; name: string; code?: string; created_at?: string };
export type AdminSchoolsResponse = { schools: AdminSchoolOption[] };

/* ----------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

// 401 / 403 / 404 will not fix themselves by retrying.
const NO_RETRY = [401, 403, 404];
const retryPolicy = (failureCount: number, error: unknown) =>
  !(error instanceof HttpError && NO_RETRY.includes(error.status)) && failureCount < 1;

/** Only the filters that are really set, so {role:"all"} and {} share one cache entry. */
function activeFilters(filters: AdminUserFilters): Record<string, string> {
  const out: Record<string, string> = {};
  const search = filters.search?.trim();
  if (search) out.search = search;
  if (filters.role && filters.role !== "all") out.role = filters.role;
  if (filters.status && filters.status !== "all") out.status = filters.status;
  if (filters.schoolId && filters.schoolId !== "all") out.schoolId = filters.schoolId;
  return out;
}

/** Apply `fn` to every cached users list ({ users, pageKeys }) that is in memory. */
function updateCachedLists(qc: QueryClient, fn: (users: AdminUser[]) => AdminUser[]) {
  qc.setQueriesData<AdminUsersResponse>({ queryKey: qk.users.all }, (old) =>
    old && Array.isArray(old.users) ? { ...old, users: fn(old.users) } : old,
  );
}

/* ----------------------------------------------------------------------------
 * Queries
 * -------------------------------------------------------------------------- */

/**
 * The users list. Filters go to the server (same as the old page); the previous
 * result stays on screen while a new filter loads, so the table does not flash.
 * A 403 (e.g. a manager) is not retried: the page shows a "restricted" state.
 */
export function useAdminUsers(filters: AdminUserFilters = {}) {
  const active = activeFilters(filters);
  return useQuery<AdminUsersResponse, HttpError>({
    queryKey: qk.users.list(active),
    queryFn: ({ signal }) => {
      const qs = new URLSearchParams(active).toString();
      return apiGet<AdminUsersResponse>(`/api/admin/users${qs ? `?${qs}` : ""}`, signal);
    },
    placeholderData: keepPreviousData,
    retry: retryPolicy,
  });
}

/**
 * Schools for the filter and the create form. Uses its own key (`view: options`)
 * so it never collides with the schools page cache, but qk.schools.all
 * invalidations (create / edit a school) still refresh it.
 */
export function useAdminSchoolOptions() {
  return useQuery<AdminSchoolsResponse, HttpError>({
    queryKey: qk.schools.list({ view: "options" }),
    queryFn: ({ signal }) => apiGet<AdminSchoolsResponse>("/api/admin/schools", signal),
    staleTime: 5 * 60_000,
    retry: retryPolicy,
  });
}

/* ----------------------------------------------------------------------------
 * Mutations
 * -------------------------------------------------------------------------- */

/** POST /api/admin/users. New users start as `pending` with must_change_password. */
export function useCreateAdminUser() {
  const qc = useQueryClient();
  return useMutation<CreateAdminUserResponse, HttpError, CreateAdminUserInput>({
    mutationFn: (input) => apiSend<CreateAdminUserResponse>("POST", "/api/admin/users", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.users.all });
    },
  });
}

/** PATCH /api/admin/users — role, status, email, password flag, permissions, clear history. */
export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation<AdminOkResponse, HttpError, UpdateAdminUserInput>({
    mutationFn: (input) => apiSend<AdminOkResponse>("PATCH", "/api/admin/users", input),
    onSuccess: (_data, input) => {
      // Patch the cached rows now; the invalidation below confirms with the server.
      updateCachedLists(qc, (users) =>
        users.map((u) => {
          if (u.id !== input.id) return u;
          return {
            ...u,
            ...(input.email !== undefined ? { email: input.email || null } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.role !== undefined ? { role: input.role } : {}),
            ...(input.must_change_password !== undefined
              ? { must_change_password: input.must_change_password }
              : {}),
            ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
          };
        }),
      );
      void qc.invalidateQueries({ queryKey: qk.users.all });
    },
  });
}

/** DELETE /api/admin/users?id= (super-admin only; the server enforces it). */
export function useDeleteAdminUser() {
  const qc = useQueryClient();
  return useMutation<AdminOkResponse, HttpError, string>({
    mutationFn: (id) =>
      apiSend<AdminOkResponse>("DELETE", `/api/admin/users?id=${encodeURIComponent(id)}`),
    onSuccess: (_data, id) => {
      updateCachedLists(qc, (users) => users.filter((u) => u.id !== id));
      void qc.invalidateQueries({ queryKey: qk.users.all });
    },
  });
}
