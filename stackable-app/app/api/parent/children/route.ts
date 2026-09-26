import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { getParentChildren } from "@/lib/repositories/parent.repo";

// GET /api/parent/children — the signed-in parent's children.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { roles: ["parent"], rateLimit: "read" });
    const children = await getParentChildren(auth.userId);
    return NextResponse.json({ ok: true, data: children });
  } catch (err) {
    return toErrorResponse(err);
  }
}
