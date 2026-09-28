// =============================================================================
// GET /api/teach/students — Students assigned to the signed-in teacher
// Returns { students: TeacherStudent[]; total: number } (see portal-types.ts).
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { listTeacherStudents } from "@/lib/repositories/teacher-portal.repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, {
      roles: ["teacher", "staff", "super-admin"],
      rateLimit: "read",
    });
    const data = await listTeacherStudents(auth.userId, auth.schoolId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
