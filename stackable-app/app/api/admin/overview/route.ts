// =============================================================================
// GET /api/admin/overview — the school principal's home page numbers.
// -----------------------------------------------------------------------------
// Scoped to the signed-in user's school (from the session). The answer is the same
// for every admin of that school, so it is cached per school for 60 seconds.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { cached } from "@/lib/cache";
import { getAdminOverview } from "@/lib/repositories/admin-overview.repo";

export const dynamic = "force-dynamic";

const OVERVIEW_CACHE_SECONDS = 60; // dashboards may be up to a minute behind

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, {
      roles: ["admin", "manager", "super-admin"],
      rateLimit: "read",
    });
    const data = await cached(auth.schoolId, "admin-overview", OVERVIEW_CACHE_SECONDS, () =>
      getAdminOverview(auth.schoolId),
    );
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
