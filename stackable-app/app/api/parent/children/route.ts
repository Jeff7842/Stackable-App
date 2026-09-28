import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { cached } from "@/lib/cache";
import { getParentChildren } from "@/lib/repositories/parent.repo";

export const dynamic = "force-dynamic";

const CHILDREN_CACHE_SECONDS = 30; // short: a parent should see new grades within seconds

// GET /api/parent/children — the signed-in parent's children (ChildCard[]).
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { roles: ["parent"], rateLimit: "read" });
    const children = await cached(
      auth.schoolId,
      "parent-children",
      CHILDREN_CACHE_SECONDS,
      () => getParentChildren(auth.userId),
      auth.userId, // per-user data: the user id MUST be in the key
    );
    return NextResponse.json({ ok: true, data: children });
  } catch (err) {
    return toErrorResponse(err);
  }
}
