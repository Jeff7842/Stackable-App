import { AppError, errors } from "@stackable/service-kit";
import type { ServiceTokenClaims } from "@stackable/contracts";

export const TEACHER_ROLES = ["teacher", "admin"] as const;
export const STUDENT_ROLES = ["student", "pupil"] as const;
export const PARENT_ROLES = ["parent"] as const;
export const ADMIN_ROLES = ["admin"] as const;
export const SERVICE_ROLES = ["ai", "service"] as const; // the ai service sets the answer gate

export interface Actor {
  id: string;
  schoolId: string;
  role: string;
  /** True only when the gateway verified the school security code for this request. */
  canRelease: boolean;
}

/** Builds an application error with a DOMAIN_CONDITION code. */
export function domainError(status: 400 | 403 | 404 | 409, code: string, message: string, details: Record<string, unknown> = {}) {
  return new AppError(status, code, message, details);
}

// The contracts schema strips unknown claims, so `rel` is read from the payload the middleware already verified.
function releaseClaim(authorization: string | undefined): boolean {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return payload.rel === true;
  } catch {
    return false;
  }
}

/** Reads the verified actor from a request that already passed requireServiceToken. */
export function actorOf(c: {
  var: { claims: ServiceTokenClaims };
  req: { header(name: string): string | undefined };
}): Actor {
  const { sub, schoolId, role } = c.var.claims;
  if (!role) throw errors.forbidden("Token has no role");
  return { id: sub, schoolId, role, canRelease: releaseClaim(c.req.header("authorization")) };
}

export function requireRole(actor: Actor, roles: readonly string[]): void {
  if (!roles.includes(actor.role)) throw errors.forbidden("Your role cannot do this");
}

export const isAdmin = (actor: Actor): boolean => actor.role === "admin";
