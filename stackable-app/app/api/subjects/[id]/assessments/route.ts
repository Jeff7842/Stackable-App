// =============================================================================
// /api/subjects/[id]/assessments
//   GET  -> upcoming + past assessments for the subject offering
//   POST -> schedule an assessment and target it at some of the offering's classes
// The subject offering must belong to the caller's school (else 404).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { badRequest, toErrorResponse } from "@/lib/api/errors";
import { parseJson } from "@/lib/api/validate";
import { bumpCache, cached } from "@/lib/cache";
import { createAssessment } from "@/lib/subjects-mutations";
import {
  SUBJECT_ASSESSMENTS_TTL_SECONDS,
  SUBJECT_CACHE_ENTITY,
  SUBJECT_READ_ROLES,
  SUBJECT_WRITE_ROLES,
  getSchoolSubjectOrThrow,
  getSubjectAssessmentsData,
  requireSubjectId,
} from "@/lib/subjects-server";
import { createAssessmentSchema } from "@/lib/validation/subjects";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

/** Response: { ok: true, data: SubjectAssessmentsPayload }. */
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
      SUBJECT_ASSESSMENTS_TTL_SECONDS,
      () => getSubjectAssessmentsData(id, schoolId),
      `assessments:${id}`,
    );
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Body (JSON): { type, title, target_class_ids, description?, term?, total_marks_raw?,
 * duration_minutes?, scheduled_start_at?, scheduled_end_at?, teacher_id? }.
 * Response 201: { ok: true, data: SubjectAssessmentsPayload } (the refreshed list).
 */
export async function POST(request: NextRequest, context: Context) {
  let auth;
  try {
    auth = await requireAuth(request, {
      roles: SUBJECT_WRITE_ROLES,
      pageKey: "subjects",
      rateLimit: "mutation",
    });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const id = requireSubjectId((await context.params).id);
    const { schoolId, userId } = auth;
    const input = await parseJson(request, createAssessmentSchema);
    const offering = await getSchoolSubjectOrThrow(id, schoolId);

    if (!input.title || !input.type || input.target_class_ids.length === 0) {
      throw badRequest("Assessment title, type, and target classes are required.");
    }

    await createAssessment(offering, { ...input, title: input.title, type: input.type }, { schoolId, userId });
    await bumpCache(schoolId, SUBJECT_CACHE_ENTITY);

    const data = await getSubjectAssessmentsData(id, schoolId);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
