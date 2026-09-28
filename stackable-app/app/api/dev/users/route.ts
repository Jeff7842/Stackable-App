// GET /api/dev/users?q=&role=&schoolId=&status=&page=&pageSize= -> { ok: true, data: DevPage<DevUserRow> }
// Real super-admin only. role/status are checked against the known lists, schoolId must be an
// id, and the search text is sanitised before it reaches the database filter.

import {
  devError,
  devJson,
  listDevUsers,
  parseDevQuery,
  requireDevAuth,
  usersQuerySchema,
} from "@/lib/dev-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireDevAuth(request);
    const query = parseDevQuery(usersQuerySchema, request.url);
    return devJson(await listDevUsers(query));
  } catch (err) {
    return devError(err);
  }
}
