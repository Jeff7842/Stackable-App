import { NextRequest, NextResponse } from "next/server";
import { getSubjectDetailData, getSchoolSubjectOrThrow } from "@/lib/subjects-server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse, notFound } from "@/lib/api/errors";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  let ctx;
  try {
    ctx = await requireAuth(request, { pageKey: "subjects", rateLimit: "read" });
  } catch (err) { return toErrorResponse(err); }

  try {
    const { id } = await context.params;

    // Cross-tenant guard: verify the school_subject belongs to the caller's school.
    const offering = await getSchoolSubjectOrThrow(id);
    if (offering.school_id !== ctx.schoolId) {
      return toErrorResponse(notFound());
    }

    const data = await getSubjectDetailData(id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("subject detail route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
