import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { badRequest, toErrorResponse } from "@/lib/api/errors";
import { getChildOverview } from "@/lib/repositories/parent.repo";
import { isUuid } from "@/lib/repositories/portal-shared";

export const dynamic = "force-dynamic";

// GET /api/parent/children/[studentId] — ChildOverview (grades, attendance, subjects) for ONE child.
// The repository refuses if the child isn't linked to this parent (403). Not cached: the
// link check must run on every request.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const auth = await requireAuth(request, { roles: ["parent"], rateLimit: "read" });
    const { studentId } = await params;
    // Validate at the gate: a malformed id must not reach a uuid column (that would be a 500).
    if (!isUuid(studentId)) throw badRequest("Invalid student id.");

    const overview = await getChildOverview(auth.userId, studentId);
    return NextResponse.json({ ok: true, data: overview });
  } catch (err) {
    return toErrorResponse(err);
  }
}
