// =============================================================================
// GET /api/auth/me — who is signed in right now.
// -----------------------------------------------------------------------------
// The dashboard shell (navbar name, role chip, school name and the impersonation
// banner) reads this through the useMe() hook. Any signed-in user may call it; it
// only ever returns THEIR OWN details, taken from the validated session (never
// from the request), and never returns password hashes or any other column.
//
// Data comes from PostgreSQL through Prisma (lib/repositories/me.repo.ts).
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { forbidden, toErrorResponse, unauthorized } from "@/lib/api/errors";
import { findMeProfile } from "@/lib/repositories/me.repo";
import { ROLE_DASHBOARD, ROLE_HOME } from "@/lib/validation/shared";

// Session-dependent and must never be prerendered or served from a cache.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request) {
  try {
    // No `roles`: every signed-in role may read its own identity.
    const ctx = await requireAuth(request);

    // A role we do not recognise has no portal to land in.
    const home = ROLE_HOME[ctx.role] as string | undefined;
    const portal = ROLE_DASHBOARD[ctx.role] as string | undefined;
    if (!home || !portal) throw forbidden("Your account has no valid role.");

    const profile = await findMeProfile(ctx.userId, ctx.schoolId);

    // The session was valid a moment ago but the user row is gone: treat as signed out.
    if (!profile) throw unauthorized();

    return NextResponse.json(
      {
        id: ctx.userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        role: ctx.role,
        schoolId: ctx.schoolId,
        schoolCode: ctx.schoolCode,
        schoolName: profile.schoolName,
        portal,
        home,
        // While a super-admin is viewing as this user, ctx is the TARGET's (so id, role,
        // name and school above are the target's) and this says who is really behind it.
        // Only display fields: the impersonation row id is never sent to the browser.
        impersonatedBy: ctx.impersonatedBy
          ? {
              id: ctx.impersonatedBy.id,
              name: ctx.impersonatedBy.name,
              role: ctx.impersonatedBy.role,
              reason: ctx.impersonatedBy.reason,
              expiresAt: ctx.impersonatedBy.expiresAt,
            }
          : null,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    // A cached 401/403 would keep a signed-in user looking signed out.
    const res = toErrorResponse(error);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
}
