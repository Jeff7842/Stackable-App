// =============================================================================
// GET /api/teachers/[id]/edit-data — everything the teacher edit page loads in one
// call: the teacher, the subject catalogue, the school's classes, current subject /
// class assignments and the weekly timetable.
// Response: { ok: true, data: TeacherEditData }. 404 for an id outside the caller's school.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { teacherAdmin } from "@/lib/services/teacher-admin.api";
import { ADMIN_ROLES, assertUuid } from "@/lib/validation/admin-common";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "teachers", rateLimit: "read" });
    const id = assertUuid((await context.params).id);
    const data = await teacherAdmin.editData(auth.schoolId, id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
