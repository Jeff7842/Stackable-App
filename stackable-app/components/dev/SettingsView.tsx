"use client";

// =============================================================================
// SettingsView - /dev/settings. Read-only platform facts from
// DevOverview.platform, as tidy label / value rows in one card. Nothing here can be
// changed: these are environment values. No secrets are ever part of the payload.
// =============================================================================

import type { ReactNode } from "react";
import { Badge, Icon } from "@/components/ui";
import { useDevOverview } from "@/hooks/useDevOverview";
import type { DevOverview } from "@/lib/dev-types";
import { DevIntro } from "./DevIntro";
import { ErrorPanel } from "./ErrorPanel";
import { titleCase } from "./format";
import { RowsSkeleton } from "./skeletons";

const BACKEND_LABEL: Record<string, string> = {
  supabase: "Supabase",
  prisma: "Prisma (Neon)",
};

const AUTH_LABEL: Record<string, string> = {
  legacy: "Legacy (Supabase sessions)",
  betterauth: "Better Auth",
};

function Configured({ on }: { on: boolean }) {
  return (
    <Badge tone={on ? "info" : "neutral"} dot>
      {on ? "Configured" : "Not configured"}
    </Badge>
  );
}

function rows(platform: DevOverview["platform"]): { label: string; value: ReactNode }[] {
  return [
    { label: "App version", value: <span className="font-mono text-xs font-medium">{platform.appVersion || "-"}</span> },
    { label: "Data backend", value: BACKEND_LABEL[platform.dataBackend] ?? titleCase(platform.dataBackend) },
    { label: "Auth provider", value: AUTH_LABEL[platform.authProvider] ?? titleCase(platform.authProvider) },
    { label: "Environment", value: titleCase(platform.nodeEnv) },
    { label: "Redis", value: <Configured on={platform.redisConfigured} /> },
    { label: "QStash", value: <Configured on={platform.qstashConfigured} /> },
  ];
}

export function SettingsView() {
  const overview = useDevOverview();

  return (
    <div className="space-y-6">
      <DevIntro subtitle="How this deployment is set up. These values come from the environment." />

      {overview.isPending ? (
        <RowsSkeleton rows={6} />
      ) : overview.isError && !overview.data ? (
        <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
          <ErrorPanel error={overview.error} onRetry={() => void overview.refetch()} retrying={overview.isFetching} />
        </div>
      ) : overview.data ? (
        <>
          <section
            aria-labelledby="dev-platform-heading"
            className="rounded-2xl bg-surface p-3 shadow-soft ring-1 ring-ghost animate-fade-up"
          >
            <h2 id="dev-platform-heading" className="sr-only">
              Platform facts
            </h2>
            <dl>
              {rows(overview.data.platform).map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 rounded-xl px-4 py-3.5 text-sm odd:bg-recessed/60"
                >
                  <dt className="text-ink-soft">{row.label}</dt>
                  <dd className="text-right font-semibold text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p
            className="flex items-start gap-3 rounded-2xl bg-recessed p-4 text-sm leading-relaxed text-ink-soft animate-fade-up"
            style={{ animationDelay: "120ms" }}
          >
            <Icon icon="solar:lock-keyhole-linear" width={20} className="mt-0.5 shrink-0 text-muted" />
            <span>These settings are defined in the deployment environment and cannot be changed from here.</span>
          </p>
        </>
      ) : null}
    </div>
  );
}
