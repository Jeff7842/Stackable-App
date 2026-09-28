// POST /api/dev/impersonate/start  { targetUserId, reason }  -> { ok: true, redirectTo }
// Begin viewing as another user. SECURITY-CRITICAL, in this order:
//   same-origin -> REAL session (never the impersonated one) -> real super-admin
//   -> rate limit -> body -> flow (lib/dev-server.ts startImpersonation) -> cookie.
// The cookie is set ONLY after the audit row is written (fail closed).

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api/validate";
import {
  IMPERSONATION_COOKIE,
  impersonationCookieOptions,
} from "@/lib/api/impersonation";
import {
  assertSameOrigin,
  impersonationError,
  requireRealSuperAdmin,
  startBodySchema,
  startImpersonation,
} from "@/lib/dev-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireRealSuperAdmin();
    const body = await parseJson(request, startBodySchema);

    const store = await cookies();
    const { token, redirectTo } = await startImpersonation({
      actor,
      targetUserId: body.targetUserId,
      reason: body.reason,
      existingCookie: store.get(IMPERSONATION_COOKIE)?.value,
      request,
    });

    // Reached only when the row exists AND the audit record was written.
    store.set(IMPERSONATION_COOKIE, token, impersonationCookieOptions());
    return NextResponse.json({ ok: true, redirectTo }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return impersonationError(err);
  }
}
