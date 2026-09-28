"use client";

// Role / status / school filters for the users table toolbar. They are sent to
// the API (GET /api/admin/users?role&status&schoolId), like the old page did.

import { Button, Select } from "@/components/ui";
import type { AdminSchoolOption, AdminUserFilters } from "@/hooks/useAdminUsers";
import type { Role, UserStatus } from "@/lib/validation/shared";
import { FILTER_ROLES, ROLE_LABEL, STATUSES, STATUS_LABEL } from "./userUtils";

/** The three filters this bar controls ("all" = no filter). */
export type UserFilterState = Required<Pick<AdminUserFilters, "role" | "status" | "schoolId">>;

export const EMPTY_FILTERS: UserFilterState = { role: "all", status: "all", schoolId: "all" };

export const hasActiveFilters = (f: UserFilterState) =>
  f.role !== "all" || f.status !== "all" || f.schoolId !== "all";

export interface UserFiltersProps {
  value: UserFilterState;
  onChange: (next: UserFilterState) => void;
  schools: AdminSchoolOption[];
}

export function UserFilters({ value, onChange, schools }: UserFiltersProps) {
  return (
    <>
      {/* Each select sits in a fixed-width wrapper: the control shell itself is w-full. */}
      <div className="w-36">
        <Select
          size="sm"
          pill
          aria-label="Filter by role"
          value={value.role}
          onChange={(e) => onChange({ ...value, role: e.target.value as Role | "all" })}
        >
          <option value="all">All roles</option>
          {FILTER_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-36">
        <Select
          size="sm"
          pill
          aria-label="Filter by status"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value as UserStatus | "all" })}
        >
          <option value="all">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-44">
        <Select
          size="sm"
          pill
          aria-label="Filter by school"
          value={value.schoolId}
          onChange={(e) => onChange({ ...value, schoolId: e.target.value })}
        >
          <option value="all">All schools</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </Select>
      </div>

      {hasActiveFilters(value) ? (
        <Button size="sm" variant="ghost" leftIcon="solar:restart-linear" onClick={() => onChange(EMPTY_FILTERS)}>
          Clear
        </Button>
      ) : null}
    </>
  );
}

export default UserFilters;
