// =============================================================================
// GET /api/teachers/photo?path=teachers/{teacherId}/{file} — serves a teacher's photo.
// -----------------------------------------------------------------------------
// Any signed-in user of the SAME school may read it (avatars appear in every portal).
// The path must be exactly teachers/{uuid}/{file}, and the teacher in it must belong
// to the caller's school; anything else is a 404. The bytes come from lib/storage.ts,
// and the content type is always a real image type, never an arbitrary stored one.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { badRequest, notFound, toErrorResponse } from "@/lib/api/errors";
import { teacherAdmin } from "@/lib/services/teacher-admin.api";
import { parsePhotoPath, readStoredTeacherPhoto } from "@/lib/teacher-photo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { rateLimit: "read" });

    const filePath = request.nextUrl.searchParams.get("path")?.trim();
    if (!filePath) throw badRequest("Missing teacher photo path.");

    const parsed = parsePhotoPath(filePath);
    if (!parsed || !(await teacherAdmin.exists(auth.schoolId, parsed.teacherId))) throw notFound();

    const photo = await readStoredTeacherPhoto(filePath);
    if (!photo) throw notFound("Teacher photo not found.");

    return new NextResponse(photo.data, {
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
