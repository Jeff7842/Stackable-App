// =============================================================================
// GET /api/teach/students/[studentId] — one assigned student's profile
// -----------------------------------------------------------------------------
// Returns TeacherStudentProfile. Allowed ONLY for students assigned to the
// signed-in teacher; anyone else gets a plain 404 so ids cannot be probed.
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { badRequest, toErrorResponse } from "@/lib/api/errors";
import { getTeacherStudentProfile } from "@/lib/repositories/teacher-portal.repo";
import { isUuid } from "@/lib/repositories/portal-shared";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const auth = await requireAuth(request, {
      roles: ["teacher", "staff", "super-admin"],
      rateLimit: "read",
    });
    const { studentId } = await params;
    // Validate at the gate: a malformed id must not reach a uuid column (that would be a 500).
    if (!isUuid(studentId)) throw badRequest("Invalid student id.");

    const data = await getTeacherStudentProfile(auth.userId, auth.schoolId, studentId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
