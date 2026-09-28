import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { listSchools } from "@/lib/repositories/school.repo";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, { roles: ["admin", "super-admin"], rateLimit: "read" });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const schools = await listSchools();
    return NextResponse.json({ schools });
  } catch (error) {
    console.error("admin schools list route error", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
