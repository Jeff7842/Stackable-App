// GET /api/dev/schools?q=&page=&pageSize= -> { ok: true, data: DevPage<DevSchoolRow> }
// Real super-admin only. Search matches name, code and e-mail; pageSize is clamped to 1..100.

import {
  devError,
  devJson,
  listDevSchools,
  parseDevQuery,
  requireDevAuth,
  schoolsQuerySchema,
} from "@/lib/dev-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireDevAuth(request);
    const query = parseDevQuery(schoolsQuerySchema, request.url);
    return devJson(await listDevSchools(query));
  } catch (err) {
    return devError(err);
  }
}
