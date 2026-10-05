// Demo mode: a session cookie names the demo role; no data or API access comes with it.
import { ROLES, type Role } from "@/lib/validation/shared";

export const DEMO_COOKIE = "stackable_demo";

/** Returns the role named by the cookie value, or null if it is missing or unknown. */
export function parseDemoRole(value: string | null | undefined): Role | null {
  return (ROLES as readonly string[]).includes(value ?? "") ? (value as Role) : null;
}
