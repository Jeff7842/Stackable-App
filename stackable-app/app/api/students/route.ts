// =============================================================================
// GET /api/students — the school's student register for the admin workspace.
// -----------------------------------------------------------------------------
// Replaces the old page's direct browser database read. Scoped to the caller's
// school (from the session), max 5000 rows, with status counts and the class
// filter list. Response: { ok: true, data: StudentListData }.
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
    const data = await studentAdmin.list(auth.schoolId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
