/**
 * Status chips for a school.
 *  - SchoolStatusBadge:        active | pending | suspended   (the school itself)
 *  - SubscriptionStatusBadge:  active | trial | expired | suspended | inactive
 * Colours come from the Badge tones (design tokens only). Server-safe (no hooks).
 */
import { Badge, type BadgeTone } from "@/components/ui";
import type { SchoolStatus, SubscriptionStatus } from "@/hooks/useSchools";

const SCHOOL_TONE: Record<SchoolStatus, BadgeTone> = {
  active: "active", // dot pings: a live school
  pending: "pending",
  suspended: "suspended",
};

const SUBSCRIPTION_TONE: Record<SubscriptionStatus, BadgeTone> = {
  active: "success",
  trial: "info",
  expired: "warning",
  suspended: "error",
  inactive: "neutral",
};

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function SchoolStatusBadge({ status }: { status: SchoolStatus }) {
  return (
    <Badge tone={SCHOOL_TONE[status] ?? "neutral"} dot>
      {capitalise(status)}
    </Badge>
  );
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return <Badge tone={SUBSCRIPTION_TONE[status] ?? "neutral"}>{capitalise(status)}</Badge>;
}
