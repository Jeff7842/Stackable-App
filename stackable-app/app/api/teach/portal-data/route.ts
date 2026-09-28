// =============================================================================
// GET /api/teach/portal-data — Teacher portal home data (TeacherPortalData)
// -----------------------------------------------------------------------------
// Scoped to the logged-in teacher. Because the `teachers` table has no user_id
// FK, the repository resolves the teacher from the user's email (see
// teacher-portal.repo.ts). Per-user answer, so the cache key includes the user id.
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { cached } from "@/lib/cache";
import { getTeacherPortalData } from "@/lib/repositories/teacher-portal.repo";

export const dynamic = "force-dynamic";

const PORTAL_CACHE_SECONDS = 30; // keeps quick page revisits cheap without hiding new grades for long

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, {
      roles: ["teacher", "staff", "super-admin"],
      rateLimit: "read",
    });
    const data = await cached(
      auth.schoolId,
      "teach-portal-data",
      PORTAL_CACHE_SECONDS,
      () => getTeacherPortalData(auth.userId, auth.schoolId),
      auth.userId, // per-user data: the user id MUST be in the key
    );
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
