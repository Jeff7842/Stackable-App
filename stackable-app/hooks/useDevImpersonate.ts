// =============================================================================
// useDevImpersonate - POST /api/dev/impersonate/start
// -----------------------------------------------------------------------------
// Body:      { targetUserId, reason (10-500 chars) }
// Success:   flat { ok: true, redirectTo }   (NOT wrapped in `data`)
// Errors:    400 validation, 403 not allowed, 404 target, 409 already
//            impersonating, 429 rate limit, 503 tables not installed. The server
//            message reaches the UI untouched via HttpError.message.
//
// On success we (1) let the caller react (toast), (2) wipe the TanStack cache so
// nothing from the developer identity survives, and (3) do a FULL page navigation
// so the server layouts re-run under the new identity. router.push would keep the
// old client cache and the old server-rendered shell, which is exactly wrong here.
// =============================================================================

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiSend, HttpError } from "@/lib/api/http";
import type { ImpersonateResponse, ImpersonateStartBody } from "@/lib/dev-types";

/** Only same-origin paths; anything else falls back to the site root (defence in depth). */
function safeRedirect(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export function useDevImpersonate(options: { onStarted?: (response: ImpersonateResponse) => void } = {}) {
  const queryClient = useQueryClient();
  const { onStarted } = options;

  return useMutation<ImpersonateResponse, HttpError, ImpersonateStartBody>({
    mutationFn: (body) => {
      console.info("[dev] starting impersonation", { targetUserId: body.targetUserId });
      return apiSend<ImpersonateResponse>("POST", "/api/dev/impersonate/start", body);
    },
    onSuccess: (response) => {
      console.info("[dev] impersonation started, redirecting", { redirectTo: response.redirectTo });
      onStarted?.(response);
      queryClient.clear();
      window.location.assign(safeRedirect(response.redirectTo));
    },
    onError: (error) => {
      console.error("[dev] impersonation failed", error.status, error.message);
    },
  });
}
