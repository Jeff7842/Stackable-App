// =============================================================================
// GET /api/teachers/[id]/attendance?limit=200 — the teacher's clock-in history.
// Counts (present / late / absent / total) cover ALL records; `records` are the
// newest `limit` (default 200, max 500). This is what the old
// /dashboard/teachers/[id]/students page showed.
// Response: { ok: true, data: TeacherAttendanceData }.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { parse } from "@/lib/api/validate";
import { teacherAdmin } from "@/lib/services/teacher-admin.api";
import { ADMIN_ROLES, assertUuid } from "@/lib/validation/admin-common";
import { attendanceQuerySchema } from "@/lib/validation/teachers";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "teachers", rateLimit: "read" });
    const id = assertUuid((await context.params).id);
    const { limit } = parse(attendanceQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
    const data = await teacherAdmin.attendance(auth.schoolId, id, limit);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
