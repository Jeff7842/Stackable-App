// =============================================================================
// /api/assessments — assessments for one subject offering, addressed by
// `school_subject_id` (query for GET, body for POST). Same data and rules as
// /api/subjects/[id]/assessments; the offering must belong to the caller's school
// (another school's id is a 404), and reads/writes share the subjects cache.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { badRequest, toErrorResponse } from "@/lib/api/errors";
import { parse } from "@/lib/api/validate";
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

/** GET ?school_subject_id=<uuid> -> { ok: true, data: SubjectAssessmentsPayload }. */
export async function GET(request: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(request, {
      roles: SUBJECT_READ_ROLES,
      pageKey: "exams",
      rateLimit: "read",
    });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const rawId = request.nextUrl.searchParams.get("school_subject_id");
    if (!rawId) throw badRequest("school_subject_id is required.");

    const id = requireSubjectId(rawId);
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
 * POST JSON { school_subject_id, type, title, target_class_ids, description?, term?,
 * total_marks_raw?, duration_minutes?, scheduled_start_at?, scheduled_end_at?, teacher_id? }.
 * Response 201: { ok: true, data: SubjectAssessmentsPayload }.
 */
export async function POST(request: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(request, {
      roles: SUBJECT_WRITE_ROLES,
      pageKey: "exams",
      rateLimit: "mutation",
    });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const { schoolId, userId } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw badRequest("Request body must be valid JSON.");
    }

    const rawId = String((body as { school_subject_id?: unknown } | null)?.school_subject_id ?? "").trim();
    const input = parse(createAssessmentSchema, body);

    if (!rawId || !input.title || !input.type || input.target_class_ids.length === 0) {
      throw badRequest("school_subject_id, title, type, and target classes are required.");
    }

    const id = requireSubjectId(rawId);
    const offering = await getSchoolSubjectOrThrow(id, schoolId);

    await createAssessment(offering, { ...input, title: input.title, type: input.type }, { schoolId, userId });
    await bumpCache(schoolId, SUBJECT_CACHE_ENTITY);

    const data = await getSubjectAssessmentsData(id, schoolId);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
