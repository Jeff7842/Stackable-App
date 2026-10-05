// =============================================================================
// Tiny presentation helpers shared by the sidebar, top bar, profile modal and
// impersonation banner. Pure functions, safe on server and client.
// =============================================================================

import type { Portal } from "@/lib/validation/shared";
import type { Me } from "@/hooks/useMe";
import { PORTAL_LABEL } from "@/lib/nav";

/** "super-admin" -> "Super admin". Falls back to the portal label. */
export function formatRole(role: string | null | undefined, portal: Portal): string {
  if (!role) return PORTAL_LABEL[portal];
  const spaced = role.replace(/[-_]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** First + last name, else the part of the email before "@", else "Account". */
export function displayName(me: Pick<Me, "firstName" | "lastName" | "email"> | null | undefined): string {
  if (!me) return "Account";
  const full = [me.firstName, me.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (me.email) return me.email.split("@")[0];
  return "Account";
}

/**
 * Role accent chip colours per portal (tokens only, dark-mode aware).
 * Developer is inverted (ink on canvas) so the platform console is unmistakable.
 */
export const PORTAL_CHIP: Record<Portal, string> = {
  dashboard: "bg-primary-tint text-primary-ink",
  principal: "bg-primary-tint text-primary-ink",
  teacher: "bg-info-tint text-info",
  staff: "bg-info-tint text-info",
  student: "bg-success-tint text-success",
  parent: "bg-accent-tint text-accent-ink",
  developer: "bg-ink text-canvas",
};
