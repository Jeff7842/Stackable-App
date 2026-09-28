/**
 * ServiceStatusBadge - the one mapping from a service status to a Badge.
 *   ok         -> success dot that pulses (live)   "Operational"
 *   down       -> error dot                        "Down"
 *   dormant    -> neutral                          "Dormant - not configured"
 *   configured -> info                             "Configured"
 * Server-component safe.
 */
import { Badge, type BadgeTone } from "@/components/ui";
import type { DevServiceStatus } from "@/lib/dev-types";

const STATUS: Record<DevServiceStatus, { tone: BadgeTone; label: string }> = {
  ok: { tone: "active", label: "Operational" },
  down: { tone: "error", label: "Down" },
  dormant: { tone: "neutral", label: "Dormant - not configured" },
  configured: { tone: "info", label: "Configured" },
};

export function ServiceStatusBadge({ status }: { status: DevServiceStatus }) {
  const { tone, label } = STATUS[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
