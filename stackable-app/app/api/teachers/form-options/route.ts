// =============================================================================
// GET /api/teachers/form-options — the caller's school, its classes (with the current
// class teacher id) and the subject catalogue, for the create-teacher form.
// Response: { ok: true, data: { schools, classes, subjects } }.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { teacherAdmin } from "@/lib/services/teacher-admin.api";
import { ADMIN_ROLES } from "@/lib/validation/admin-common";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "teachers", rateLimit: "read" });
    const data = await teacherAdmin.formOptions(auth.schoolId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
