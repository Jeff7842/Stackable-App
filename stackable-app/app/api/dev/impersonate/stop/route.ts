// POST /api/dev/impersonate/stop  -> { ok: true, redirectTo: "/dev" }
// Stop viewing as another user. Works WHILE impersonating, so it uses the REAL session.
// The cookie is ALWAYS cleared (even on 401 or a database outage): a developer must never be
// trapped in someone else's account. Idempotent: nothing to stop is still a success.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api/errors";
import { resolveRealSession } from "@/lib/api/guard";
import {
  IMPERSONATION_COOKIE,
  clearedImpersonationCookieOptions,
} from "@/lib/api/impersonation";
import { assertSameOrigin, impersonationError, stopImpersonation } from "@/lib/dev-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    // Clear first: whatever happens next, the browser drops the impersonation cookie.
    const store = await cookies();
    const cookieToken = store.get(IMPERSONATION_COOKIE)?.value;
    store.set(IMPERSONATION_COOKIE, "", clearedImpersonationCookieOptions());

    const actor = await resolveRealSession();
    if (!actor) throw unauthorized();

    await stopImpersonation({ actor, cookieToken, request });
    return NextResponse.json({ ok: true, redirectTo: "/dev" }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return impersonationError(err);
  }
}
