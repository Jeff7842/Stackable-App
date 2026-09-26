import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse, notFound } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuth(request, { rateLimit: "read" });
  } catch (err) { return toErrorResponse(err); }

  try {
    const path = request.nextUrl.searchParams.get("path");
    if (!path) {
      return NextResponse.json({ error: "path is required." }, { status: 400 });
    }

    // Storage paths are: {schoolId}/{subjectId}/{classId}/...
    // The first segment is the school UUID — verify it matches the caller's school.
    const pathSchoolId = path.split("/")[0];
    if (!pathSchoolId || pathSchoolId !== ctx.schoolId) {
      return toErrorResponse(notFound());
    }

    const signed = await supabaseAdmin.storage
      .from("subject_resources")
      .createSignedUrl(path, 60 * 10);

    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json(
        { error: signed.error?.message ?? "Could not create a signed resource URL." },
        { status: 500 },
      );
    }

    return NextResponse.redirect(signed.data.signedUrl);
  } catch (error) {
    console.error("subject resource proxy route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
