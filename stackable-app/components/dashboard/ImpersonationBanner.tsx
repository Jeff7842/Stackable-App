"use client";

// =============================================================================
// ImpersonationBanner - slim bar at the very top of the shell while a
// super-admin is "viewing as" another user. It is the ONE gold element on the
// screen on purpose: you must never forget you are not yourself.
// -----------------------------------------------------------------------------
// Exit -> POST /api/dev/impersonate/stop. That endpoint ships in wave 2, so a
// 404 is handled with a friendly toast. On success: refresh identity + data
// and go back to the developer console.
// =============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { apiSend, HttpError } from "@/lib/api/http";
import { useMe } from "@/hooks/useMe";
import { useToast } from "@/components/toast/ToastProvider";
import { displayName } from "./format";

/** Fixed height, mirrored by `--banner-h` in DashboardShell so sticky offsets line up. */
export const BANNER_HEIGHT = "2.5rem";

export function ImpersonationBanner() {
  const me = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);

  const impersonatedBy = me.data?.impersonatedBy;
  if (!me.data || !impersonatedBy) return null;

  const roleLabel = me.data.role.replace(/[-_]+/g, " ");

  const exit = async () => {
    if (pending) return;
    setPending(true);
    console.info("[dashboard] exiting impersonation");
    try {
      await apiSend("POST", "/api/dev/impersonate/stop");
      await queryClient.invalidateQueries();
      router.replace("/dev");
      router.refresh();
    } catch (error) {
      console.error("[dashboard] could not exit impersonation", error);
      if (error instanceof HttpError && error.status === 404) {
        showToast({
          type: "info",
          title: "Exit is not available yet",
          description: "The impersonation service is still being connected.",
        });
      } else {
        showToast({
          type: "error",
          title: "Could not exit",
          description: error instanceof HttpError ? error.message : "Check your connection and try again.",
        });
      }
      setPending(false);
    }
  };

  return (
    <div
      role="status"
      style={{ height: BANNER_HEIGHT }}
      className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-accent-tint px-4 text-sm text-ink"
    >
      <span aria-hidden="true" className="relative inline-flex size-2 shrink-0">
        <span className="absolute inset-0 rounded-full bg-accent animate-pulse-dot" />
        <span className="relative size-2 rounded-full bg-accent" />
      </span>
      <Icon icon="solar:eye-bold" width={18} className="hidden shrink-0 text-accent-ink sm:block" />
      <span className="min-w-0 truncate">
        Viewing as <strong className="font-semibold">{displayName(me.data)}</strong>{" "}
        <span className="capitalize">({roleLabel})</span>
        {impersonatedBy.reason ? (
          <span className="hidden text-ink-soft lg:inline"> &middot; {impersonatedBy.reason}</span>
        ) : null}
      </span>
      <Button variant="accent" size="sm" loading={pending} onClick={() => void exit()} className="shrink-0">
        Exit
      </Button>
    </div>
  );
}

export default ImpersonationBanner;
