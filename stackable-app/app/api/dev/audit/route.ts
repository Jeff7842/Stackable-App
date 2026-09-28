// GET /api/dev/audit?actor=&target=&action=&from=&to=&page=&pageSize= -> { ok: true, data: DevPage<DevAuditRow> }
// Real super-admin only. `action` is a prefix; from/to are inclusive ISO dates. Answers 503
// with a clear message when the database migrations have not been run (audit table missing).

import {
  auditQuerySchema,
  devError,
  devJson,
  listDevAudit,
  parseDevQuery,
  requireDevAuth,
} from "@/lib/dev-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireDevAuth(request);
    const query = parseDevQuery(auditQuerySchema, request.url);
    return devJson(await listDevAudit(query));
  } catch (err) {
    return devError(err);
  }
}
