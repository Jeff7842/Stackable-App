// =============================================================================
// Audit context — the "who and from where" attached to every audit row.
// -----------------------------------------------------------------------------
// Routes call buildAuditContext(req, auth) once and hand the result down to the
// service, which passes it to the repository. Kept out of the repositories because
// it reads HTTP request headers.
// =============================================================================

import type { AuditContext } from "@/lib/repositories/audit-log.repo";
import type { AuthContext } from "@/lib/api/guard";
import { describeRequest } from "@/lib/api/impersonation";

/**
 * Describe the caller for the audit log.
 *
 * @param req the incoming request (ip, user agent and path are sanitised before use)
 * @param auth the signed-in context from requireAuth()
 * @returns the actor (the real super-admin while viewing as someone), ip, user agent, method, path
 */
export function buildAuditContext(req: Request, auth: AuthContext): AuditContext {
  const meta = describeRequest(req);
  const viewer = auth.impersonatedBy;
  return {
    actorUserId: viewer ? viewer.id : auth.userId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    method: req.method.toUpperCase(),
    path: meta.path,
    viewedUserId: viewer ? auth.userId : null,
  };
}
