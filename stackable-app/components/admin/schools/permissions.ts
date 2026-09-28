/**
 * What the signed-in role may do on the Schools page.
 *
 * This only decides which buttons to SHOW. The API routes are the real
 * enforcement point (see app/api/school/**):
 *   - list / view / create / edit / status actions / logo upload: admin, super-admin
 *   - delete + security-codes PDF: super-admin only
 * A `manager` is let into the dashboard but the school routes answer 403, so the
 * page shows an "no access" state for them instead of a table.
 */
import type { Role } from "@/lib/validation/shared";

export type SchoolPermissions = {
  /** Create, edit, suspend / activate, capacity, regenerate code, logo. */
  canWrite: boolean;
  /** Delete a school. */
  canDelete: boolean;
  /** Download the security-codes PDF. */
  canSecurityCodes: boolean;
};

export function schoolPermissions(role: Role | undefined): SchoolPermissions {
  // While /api/auth/me is loading the role is unknown: show nothing risky yet.
  const superAdmin = role === "super-admin";
  return {
    canWrite: superAdmin || role === "admin",
    canDelete: superAdmin,
    canSecurityCodes: superAdmin,
  };
}
