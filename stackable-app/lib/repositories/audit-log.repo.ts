// =============================================================================
// Audit log repository (Prisma + PostgreSQL) — who changed what, and when.
// -----------------------------------------------------------------------------
// Used by the school and user admin repositories. The audit row is written in the
// SAME transaction as the change it describes, so a change can never exist without
// its record (and a failed audit write rolls the change back: fail closed).
//
// audit_logs has deliberately NO foreign keys: rows must outlive the schools and
// users they mention (a deleted school still has its "school.delete" record).
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Who is acting and from where. Built once per request by lib/api/audit-context.ts. */
export type AuditContext = {
  /** The REAL person: while a super-admin views as someone, this is the super-admin. */
  actorUserId: string;
  ip: string | null;
  userAgent: string | null;
  method: string | null;
  path: string | null;
  /** Set when the request ran under "view as": the account that was being viewed. */
  viewedUserId?: string | null;
};

export type AuditEntry = {
  /** The school the change belongs to (null for platform-level events). */
  schoolId: string | null;
  /** Machine-readable event name, e.g. "school.suspend" or "user.role_change". */
  action: string;
  targetUserId?: string | null;
  /** Small JSON facts (before/after values). Never put passwords, codes or tokens here. */
  metadata?: Record<string, unknown>;
};

/** Anything that can run an insert: the shared client or a transaction handle. */
type AuditClient = Pick<Prisma.TransactionClient, "audit_logs">;

/**
 * Write one audit row using the given client (pass the transaction handle to make it atomic).
 *
 * @param client prisma or a `tx` from prisma.$transaction
 * @param ctx who/where, from buildAuditContext()
 * @param entry what happened
 * @throws when the insert fails; callers inside a transaction let it roll the change back
 */
export async function insertAudit(client: AuditClient, ctx: AuditContext, entry: AuditEntry): Promise<void> {
  await client.audit_logs.create({
    data: {
      school_id: entry.schoolId,
      actor_user_id: ctx.actorUserId,
      target_user_id: entry.targetUserId ?? null,
      action: entry.action,
      method: ctx.method,
      path: ctx.path,
      metadata: {
        ...(entry.metadata ?? {}),
        ...(ctx.viewedUserId ? { viewed_user_id: ctx.viewedUserId } : {}),
      } as Prisma.InputJsonObject,
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
    },
    select: { id: true },
  });
}

/** Write one audit row on its own (for events that have no database change to be atomic with). */
export function recordAudit(ctx: AuditContext, entry: AuditEntry): Promise<void> {
  return insertAudit(prisma, ctx, entry);
}
