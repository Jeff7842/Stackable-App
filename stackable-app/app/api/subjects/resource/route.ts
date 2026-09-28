// =============================================================================
// GET /api/subjects/resource?path=<storage path>
// Redirects to a short-lived signed URL for a coursework file. Only files that
// belong to the caller's own school can be signed: the path must have the exact
// shape we generate and start with the session's school id. Staff (SUBJECT_READ_ROLES)
// can open any of their school's files; every other role only PUBLIC resources.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { badRequest, notFound, toErrorResponse } from "@/lib/api/errors";
import { createSignedUrl } from "@/lib/storage";
import { SUBJECT_RESOURCES_BUCKET } from "@/lib/subjects";
import {
  SUBJECT_READ_ROLES,
  getResourceVisibilityByPath,
  isOwnResourcePath,
} from "@/lib/subjects-server";

export const dynamic = "force-dynamic";

const SIGNED_URL_SECONDS = 60 * 10; // long enough to start a download or stream, short enough to not be shareable

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuth(request, { rateLimit: "read" });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const path = request.nextUrl.searchParams.get("path");
    if (!path) throw badRequest("path is required.");

    // Same 404 for "not yours" and "does not exist" so paths can't be probed.
    if (!isOwnResourcePath(path, ctx.schoolId)) throw notFound();

    // The file must belong to a resource row of THIS school; non-staff roles only get public ones.
    const visibility = await getResourceVisibilityByPath(path, ctx.schoolId);
    if (!visibility) throw notFound();
    if (!SUBJECT_READ_ROLES.includes(ctx.role) && visibility !== "public") throw notFound();

    const signed = await createSignedUrl(SUBJECT_RESOURCES_BUCKET, path, SIGNED_URL_SECONDS);
    if (signed.error || !signed.url) {
      // Most often the object is gone; the provider's message stays in the server log.
      console.error("subject resource signing failed:", signed.error);
      throw notFound("Resource file not found.");
    }

    const response = NextResponse.redirect(signed.url);
    response.headers.set("Cache-Control", "private, no-store"); // the signed link is per-user and expires
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
