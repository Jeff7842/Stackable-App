import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { cached } from "@/lib/cache";
import { getStudentDashboard } from "@/lib/repositories/student.repo";

export const dynamic = "force-dynamic";

const DASHBOARD_CACHE_SECONDS = 30; // short: attendance and new grades should show up quickly

// GET /api/student/dashboard — StudentDashboardData for the signed-in student.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { roles: ["student", "pupil"], rateLimit: "read" });
    const data = await cached(
      auth.schoolId,
      "student-dashboard",
      DASHBOARD_CACHE_SECONDS,
      () => getStudentDashboard(auth.userId),
      auth.userId, // per-user data: the user id MUST be in the key
    );
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
