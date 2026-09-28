// =============================================================================
// /api/subjects
//   GET  -> the school's subject directory (cards + filter/form options)
//   POST -> create (or link) a subject and its school offering
// -----------------------------------------------------------------------------
// The school always comes from the session. GET is cached per school and every
// successful POST bumps that cache, so "add a subject, then see it" always works.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { badRequest, toErrorResponse } from "@/lib/api/errors";
import { parse } from "@/lib/api/validate";
import { bumpCache, cached } from "@/lib/cache";
import { getSubjectDirectory, getSubjectFormOptions } from "@/lib/repositories/subject.repo";
import { createSubjectOffering } from "@/lib/subjects-mutations";
import {
  SUBJECT_CACHE_ENTITY,
  SUBJECT_LIST_TTL_SECONDS,
  SUBJECT_READ_ROLES,
  SUBJECT_WRITE_ROLES,
} from "@/lib/subjects-server";
import { createSubjectSchema } from "@/lib/validation/subjects";

export const dynamic = "force-dynamic";

/**
 * GET /api/subjects — the directory for the signed-in user's school.
 * Response: { ok: true, data: SubjectDirectoryPayload }.
 */
export async function GET(request: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(request, { roles: SUBJECT_READ_ROLES, pageKey: "subjects", rateLimit: "read" });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const { schoolId } = auth;
    const data = await cached(
      schoolId,
      SUBJECT_CACHE_ENTITY,
      SUBJECT_LIST_TTL_SECONDS,
      () => getSubjectDirectory({ schoolId }),
      "list",
    );
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/subjects — create a subject offering for the signed-in user's school.
 * Body: multipart with `payload` (JSON string) and optional `background_image` file,
 * or a plain JSON body with the same fields as `payload`.
 * Response 201: { ok: true, data: { id, subject_id, school_id, options } }.
 */
export async function POST(request: NextRequest) {
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
    // schoolId comes from the session — never trust the request body for tenancy.
    const { schoolId, userId } = auth;
    if (!schoolId) throw badRequest("School is required.");

    let rawPayload: unknown = {};
    let backgroundImage: File | null = null;

    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData();
      const payloadText = form.get("payload");
      if (typeof payloadText === "string" && payloadText.trim()) {
        try {
          rawPayload = JSON.parse(payloadText);
        } catch {
          throw badRequest("Subject payload must be valid JSON.");
        }
      }
      const uploaded = form.get("background_image");
      backgroundImage = uploaded instanceof File && uploaded.size > 0 ? uploaded : null;
    } else {
      try {
        rawPayload = await request.json();
      } catch {
        throw badRequest("Request body must be valid JSON.");
      }
    }

    const input = parse(createSubjectSchema, rawPayload);
    const created = await createSubjectOffering(input, { schoolId, userId }, backgroundImage);
    await bumpCache(schoolId, SUBJECT_CACHE_ENTITY);

    const options = await getSubjectFormOptions({ schoolId });
    return NextResponse.json({ ok: true, data: { ...created, options } }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
