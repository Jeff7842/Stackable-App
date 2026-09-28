// GET /api/dev/overview -> { ok: true, data: DevOverview }
// Real super-admin only (never while viewing as another user). Counts + service health,
// cached 30 s. Logic lives in lib/dev-server.ts; a route file may only export HTTP methods.

import { devError, devJson, getDevOverview, requireDevAuth } from "@/lib/dev-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireDevAuth(request);
    return devJson(await getDevOverview());
  } catch (err) {
    return devError(err);
  }
}
