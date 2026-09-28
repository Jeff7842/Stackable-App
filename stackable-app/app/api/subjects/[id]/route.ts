// =============================================================================
// GET /api/subjects/[id] — detail for one subject offering of the caller's school.
// A subject id from another school answers 404, exactly like an id that doesn't exist.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { cached } from "@/lib/cache";
import {
  SUBJECT_CACHE_ENTITY,
  SUBJECT_DETAIL_TTL_SECONDS,
  SUBJECT_READ_ROLES,
  getSubjectDetailData,
  requireSubjectId,
} from "@/lib/subjects-server";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

/** Response: { ok: true, data: SubjectDetailPayload }. */
export async function GET(request: NextRequest, context: Context) {
  let auth;
  try {
    auth = await requireAuth(request, { roles: SUBJECT_READ_ROLES, pageKey: "subjects", rateLimit: "read" });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const id = requireSubjectId((await context.params).id);
    const { schoolId } = auth;
    const data = await cached(
      schoolId,
      SUBJECT_CACHE_ENTITY,
      SUBJECT_DETAIL_TTL_SECONDS,
      () => getSubjectDetailData(id, schoolId),
      `detail:${id}`,
    );
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
