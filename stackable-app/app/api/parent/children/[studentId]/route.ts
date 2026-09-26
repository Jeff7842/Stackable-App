import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { getChildOverview } from "@/lib/repositories/parent.repo";

// GET /api/parent/children/[studentId] — grades + attendance for ONE child.
// The repository refuses if the child isn't linked to this parent (403).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const auth = await requireAuth(request, { roles: ["parent"], rateLimit: "read" });
    const { studentId } = await params;
    const overview = await getChildOverview(auth.userId, studentId);
    return NextResponse.json({ ok: true, data: overview });
  } catch (err) {
    return toErrorResponse(err);
  }
}
