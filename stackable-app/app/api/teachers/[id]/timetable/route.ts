// =============================================================================
// /api/teachers/[id]/timetable — a teacher's weekly timetable.
//   GET -> { ok, data: TeacherTimetableData }  (slots + the school's classes + subject catalogue)
//   PUT -> { ok, data: { slots, conflicts } }   body { slots: TimetableSlotInput[] }
//          replaces the WHOLE timetable atomically; overlaps are returned as warnings.
// Scoped to the caller's school; writes need role admin, manager or super-admin.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { parseJson } from "@/lib/api/validate";
import { teacherAdmin } from "@/lib/services/teacher-admin.api";
import { ADMIN_ROLES, assertUuid } from "@/lib/validation/admin-common";
import { timetableSaveSchema } from "@/lib/validation/teachers";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "teachers", rateLimit: "read" });
    const id = assertUuid((await context.params).id);
    const data = await teacherAdmin.timetable(auth.schoolId, id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "teachers", rateLimit: "mutation" });
    const id = assertUuid((await context.params).id);
    const { slots } = await parseJson(request, timetableSaveSchema);
    const data = await teacherAdmin.saveTimetable(auth.schoolId, id, slots);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
