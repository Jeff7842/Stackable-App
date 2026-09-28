// =============================================================================
// /api/students/[id] — one student of the caller's school.
//   GET    -> { ok, data: StudentProfile }
//   PATCH  -> { ok, data: { student: StudentListItem } }   (body: StudentUpdateInput)
//   DELETE -> { ok, data: { id } }
// -----------------------------------------------------------------------------
// Every operation is scoped by the session's school: an id from another school is
// a plain 404. Writes need role admin, manager or super-admin.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { parseJson } from "@/lib/api/validate";
import { studentAdmin } from "@/lib/services/student-admin.api";
import { ADMIN_ROLES, assertUuid } from "@/lib/validation/admin-common";
import { studentUpdateSchema } from "@/lib/validation/students";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "students", rateLimit: "read" });
    const id = assertUuid((await context.params).id);
    const data = await studentAdmin.profile(auth.schoolId, id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "students", rateLimit: "mutation" });
    const id = assertUuid((await context.params).id);
    const input = await parseJson(request, studentUpdateSchema);
    const data = await studentAdmin.update(auth.schoolId, id, input);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "students", rateLimit: "mutation" });
    const id = assertUuid((await context.params).id);
    const data = await studentAdmin.remove(auth.schoolId, id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
