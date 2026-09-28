// =============================================================================
// POST /api/jobs/[job] — QStash delivers background jobs here.
// -----------------------------------------------------------------------------
// Order matters:
//   1. Verify the QStash signature FIRST. A caller without a valid signature gets
//      401 and learns nothing, not even which job names exist.
//   2. Unknown job name -> 404.
//   3. Run the handler. If it throws we answer 500 so QStash retries later.
//
// The handlers live in lib/qeue/registry.ts. Do NOT export them from this file:
// Next.js rejects any export here that is not an HTTP method or route config.
// =============================================================================

import { NextResponse } from "next/server";
import { notFound, toErrorResponse } from "@/lib/api/errors";
import { verifyQStashRequest } from "@/lib/qeue/jobs";
import { findJobHandler } from "@/lib/qeue/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ job: string }> }) {
  try {
    const { body } = await verifyQStashRequest(req);

    const { job } = await ctx.params;
    const handler = findJobHandler(job);
    if (!handler) throw notFound("Unknown job.");

    await handler(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // ApiError keeps its status (401/404/...); anything else is logged and becomes 500.
    return toErrorResponse(error);
  }
}
