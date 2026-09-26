import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { getStudentGrades } from "@/lib/repositories/student.repo";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { roles: ["student", "pupil"], rateLimit: "read" });
    const data = await getStudentGrades(auth.userId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
