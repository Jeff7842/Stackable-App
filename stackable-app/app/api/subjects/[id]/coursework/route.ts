// =============================================================================
// /api/subjects/[id]/coursework
//   GET   -> class offerings, syllabus progress, curriculum tree and resources
//   POST  -> multipart, action = create_topic | create_resource (file upload)
//   PATCH -> JSON, action = update_progress | toggle_visibility
// The subject offering, and every class offering / topic / resource id sent in a
// request, must belong to the caller's school (else 404 / 400).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { badRequest, toErrorResponse } from "@/lib/api/errors";
import { parse, parseForm } from "@/lib/api/validate";
import { bumpCache, cached } from "@/lib/cache";
import {
  createCurriculumNode,
  createResource,
  saveClassProgress,
  setResourceVisibility,
} from "@/lib/subjects-mutations";
import {
  SUBJECT_CACHE_ENTITY,
  SUBJECT_COURSEWORK_TTL_SECONDS,
  SUBJECT_READ_ROLES,
  SUBJECT_WRITE_ROLES,
  getSchoolSubjectOrThrow,
  getSubjectCourseworkData,
  requireSubjectId,
} from "@/lib/subjects-server";
import {
  courseworkQuerySchema,
  createResourceSchema,
  createTopicSchema,
  toggleVisibilitySchema,
  updateProgressSchema,
} from "@/lib/validation/subjects";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

const UNSUPPORTED_ACTION = "Unsupported coursework action.";

/**
 * Optional query: ?class_offering_id=<classOfferings[].id> returns only that class's
 * curriculum tree and resources (classOfferings still lists every class).
 * Response: { ok: true, data: SubjectCourseworkPayload }.
 */
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
    const query = parse(courseworkQuerySchema, {
      class_offering_id: request.nextUrl.searchParams.get("class_offering_id"),
    });
    const classOfferingId = query.class_offering_id;

    const data = await cached(
      schoolId,
      SUBJECT_CACHE_ENTITY,
      SUBJECT_COURSEWORK_TTL_SECONDS,
      () => getSubjectCourseworkData(id, schoolId, classOfferingId),
      `coursework:${id}:${classOfferingId ?? "all"}`,
    );
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Multipart form.
 *  action=create_topic:    school_subject_class_id, title, node_type?, sort_order?, parent_id?
 *  action=create_resource: school_subject_class_id, title, resource_type?, visibility?,
 *                          curriculum_node_id?, short_description?, author_name?,
 *                          cover_image_url?, source_url?, file?  (a file or a source_url is required)
 * Response 201: { ok: true, data: SubjectCourseworkPayload }.
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
    const offering = await getSchoolSubjectOrThrow(id, schoolId);

    const form = await request.formData();
    const action = String(form.get("action") ?? "").trim();

    if (action === "create_topic") {
      const input = parseForm(form, createTopicSchema);
      if (!input.school_subject_class_id || !input.title) {
        throw badRequest("Class offering and topic title are required.");
      }
      await createCurriculumNode(offering, {
        ...input,
        school_subject_class_id: input.school_subject_class_id,
        title: input.title,
      });
    } else if (action === "create_resource") {
      const input = parseForm(form, createResourceSchema);
      if (!input.school_subject_class_id || !input.title) {
        throw badRequest("Class offering and resource title are required.");
      }
      const upload = form.get("file");
      await createResource(
        offering,
        { ...input, school_subject_class_id: input.school_subject_class_id, title: input.title },
        upload instanceof File && upload.size > 0 ? upload : null,
        { schoolId, userId },
      );
    } else {
      throw badRequest(UNSUPPORTED_ACTION);
    }

    await bumpCache(schoolId, SUBJECT_CACHE_ENTITY);
    const data = await getSubjectCourseworkData(id, schoolId);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * JSON body.
 *  { action: "update_progress", school_subject_class_id, current_node_id?, syllabus_progress_pct? }
 *  { action: "toggle_visibility", resource_id, next_visibility: "private" | "public" }
 * Response: { ok: true, data: SubjectCourseworkPayload }.
 */
export async function PATCH(request: NextRequest, context: Context) {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw badRequest("Request body must be valid JSON.");
    }
    const action = typeof (body as { action?: unknown } | null)?.action === "string"
      ? (body as { action: string }).action
      : "";

    const offering = await getSchoolSubjectOrThrow(id, schoolId);

    if (action === "toggle_visibility") {
      await setResourceVisibility(offering, parse(toggleVisibilitySchema, body), { schoolId, userId });
    } else if (action === "update_progress") {
      await saveClassProgress(offering, parse(updateProgressSchema, body));
    } else {
      throw badRequest(UNSUPPORTED_ACTION);
    }

    await bumpCache(schoolId, SUBJECT_CACHE_ENTITY);
    const data = await getSubjectCourseworkData(id, schoolId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
