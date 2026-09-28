// =============================================================================
// Static facts about each platform service: display name, one-line purpose, icon.
// Health (status / latency) comes from GET /api/dev/overview; this file never
// holds a URL, key or secret.
// =============================================================================

import type { DevServiceHealth, DevServiceKey, DevServiceStatus } from "@/lib/dev-types";

export type ServiceMeta = { name: string; purpose: string; icon: string };

export const SERVICE_META: Record<DevServiceKey, ServiceMeta> = {
  database: {
    name: "Database",
    purpose: "PostgreSQL through Prisma: users, sign-in sessions and every dashboard's data.",
    icon: "solar:database-linear",
  },
  redis: {
    name: "Upstash Redis",
    purpose: "Response caching and rate limiting.",
    icon: "solar:bolt-linear",
  },
  qstash: {
    name: "QStash",
    purpose: "Background jobs such as queued email and exports.",
    icon: "solar:layers-minimalistic-linear",
  },
  email: {
    name: "Resend email",
    purpose: "Sign-in and password reset codes by email.",
    icon: "solar:letter-linear",
  },
  storage: {
    name: "R2 / Storage",
    purpose: "File uploads for logos, resources and the library.",
    icon: "solar:cloud-storage-linear",
  },
};

export const INTEGRATION_ORDER: DevServiceKey[] = ["database", "redis", "qstash", "email", "storage"];

/** Icon tile colours per status (tokens only, work in light and dark). */
export const STATUS_TILE: Record<DevServiceStatus, string> = {
  ok: "bg-primary-tint text-primary-ink",
  down: "bg-danger-tint text-danger",
  dormant: "bg-recessed text-muted",
  configured: "bg-info-tint text-info",
};

/** Look a service up by key; a service the API did not report is shown as dormant. */
export function findService(services: DevServiceHealth[], key: DevServiceKey): DevServiceHealth {
  return (
    services.find((service) => service.key === key) ?? {
      key,
      label: SERVICE_META[key].name,
      status: "dormant",
      configured: false,
      latencyMs: null,
    }
  );
}
