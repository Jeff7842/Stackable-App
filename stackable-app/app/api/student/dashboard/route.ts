import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { getStudentDashboard } from "@/lib/repositories/student.repo";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { roles: ["student", "pupil"], rateLimit: "read" });
    const data = await getStudentDashboard(auth.userId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
