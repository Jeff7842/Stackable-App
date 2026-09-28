// =============================================================================
// /api/teachers — the school's teacher register.
//   GET  -> { ok, data: TeacherListItem[] }    every teacher of the caller's school
//   POST -> 201 { ok, data: { id, teacher } }  create a teacher (multipart, photo required)
// -----------------------------------------------------------------------------
// Scoped to the caller's school (from the session, never from the body). Roles: admin,
// manager, super-admin. POST fields: name, email, phone, admission_number, class_id,
// subject_id, photo. A `school_id` field, if sent, is ignored.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { teacherAdmin } from "@/lib/services/teacher-admin.api";
import { ADMIN_ROLES } from "@/lib/validation/admin-common";
import { readTeacherCreateRequest } from "@/lib/validation/teachers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "teachers", rateLimit: "read" });
    const data = await teacherAdmin.list(auth.schoolId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "teachers", rateLimit: "mutation" });
    const { input, photo } = await readTeacherCreateRequest(request);
    const data = await teacherAdmin.create(auth.schoolId, input, photo);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
