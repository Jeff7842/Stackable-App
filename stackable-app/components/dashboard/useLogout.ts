"use client";

// =============================================================================
// useLogout - one logout flow for the sidebar, the user menu and the profile
// modal. POST /api/auth/logout (revokes the session + clears the cookie), then
// send the user to /login. Failures show a toast and re-enable the button.
// =============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import posthog from "posthog-js";
import { apiSend, HttpError } from "@/lib/api/http";
import { useToast } from "@/components/toast/ToastProvider";

export function useLogout(): { logout: () => Promise<void>; pending: boolean } {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);

  const logout = async () => {
    if (pending) return;
    setPending(true);
    console.info("[dashboard] logging out");
    try {
      await apiSend<{ ok: boolean }>("POST", "/api/auth/logout");
      router.replace("/login");
      router.refresh();
      // Drop everything cached for the previous user (identity, lists, ...).
      queryClient.clear();
      // Un-link analytics from this person so the next sign-in on this device starts fresh.
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) posthog.reset();
    } catch (error) {
      console.error("[dashboard] logout failed", error);
      const description =
        error instanceof HttpError
          ? error.message
          : "Check your connection and try again.";
      showToast({ type: "error", title: "Could not log out", description });
      setPending(false);
    }
  };

  return { logout, pending };
}
