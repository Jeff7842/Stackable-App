// =============================================================================
// /api/teachers/[id] — one teacher of the caller's school.
//   GET    -> { ok, data: TeacherProfileData }   teacher + pupils of their classes
//   PATCH  -> { ok, data: TeacherUpdateResult }  save the edit form (JSON, or multipart with
//             a `payload` JSON field and an optional `photo`); everything applies together or not at all
//   DELETE -> { ok, data: { id } }               409 TEACHER_HAS_GRADING_REPORTS unless ?force=true
// -----------------------------------------------------------------------------
// Roles: admin, manager, super-admin. Every operation is scoped by the session's school:
// an id from another school is a plain 404.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { parse } from "@/lib/api/validate";
import { teacherAdmin } from "@/lib/services/teacher-admin.api";
import { ADMIN_ROLES, assertUuid } from "@/lib/validation/admin-common";
import { readTeacherUpdateRequest, teacherDeleteQuerySchema } from "@/lib/validation/teachers";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "teachers", rateLimit: "read" });
    const id = assertUuid((await context.params).id);
    const data = await teacherAdmin.profile(auth.schoolId, id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "teachers", rateLimit: "mutation" });
    const id = assertUuid((await context.params).id);
    const { input, photo } = await readTeacherUpdateRequest(request);
    const data = await teacherAdmin.update(auth.schoolId, id, input, photo);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const auth = await requireAuth(request, { roles: ADMIN_ROLES, pageKey: "teachers", rateLimit: "mutation" });
    const id = assertUuid((await context.params).id);
    const { force } = parse(teacherDeleteQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
    const data = await teacherAdmin.remove(auth.schoolId, id, force);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
