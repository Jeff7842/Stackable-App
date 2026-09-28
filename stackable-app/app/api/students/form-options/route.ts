// =============================================================================
// GET /api/students/form-options — classes, school and statuses for filters and
// the student edit form. Response: { ok: true, data: StudentFormOptions }.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { studentAdmin } from "@/lib/services/student-admin.api";
import { ADMIN_ROLES } from "@/lib/validation/admin-common";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "students", rateLimit: "read" });
    const data = await studentAdmin.formOptions(auth.schoolId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
