// =============================================================================
// Impersonation repository — every database read/write behind the developer
// console's "view as another user", on Prisma + plain PostgreSQL (Neon today, your
// own server later; nothing here is host-specific).
// -----------------------------------------------------------------------------
// The RULES (who may impersonate whom, when a row still counts) live in
// lib/api/impersonation.ts. This file only stores and fetches rows.
//
// Conventions that matter for security:
//   * Only the sha256 HASH of the cookie token is ever stored or queried.
//   * Ending a row is a compare-and-set (`updateMany ... WHERE ended_at IS NULL`), so
//     when two requests race to end the same row only one of them "wins" and can audit it.
//   * Nothing here selects password_hash or any credential column.
//   * Errors are thrown as Prisma raised them. Callers must log only the error CODE,
//     never the message (Prisma messages can echo query arguments such as hashes).
// Only repositories may import lib/db/prisma.
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

/** A row of impersonation_sessions, JSON-safe (dates as ISO strings). */
export type ImpersonationRow = {
  id: string;
  actor_user_id: string;
  actor_session_id: string | null;
  target_user_id: string;
  token_hash: string;
  reason: string;
  expires_at: string;
  ended_at: string | null;
};

/** The few user columns needed to decide eligibility and to build the target's context. */
export type ImpersonationTarget = {
  id: string;
  role: string | null;
  status: string | null;
  school_id: string | null;
  school_code: string | null;
  first_name: string | null;
  last_name: string | null;
};

/** One audit_logs row to append. */
export type AuditEntry = {
  /** school of the user being viewed, or null. */
  schoolId: string | null;
  /** the REAL person who did it (the super-admin), never the target. */
  actorUserId: string;
  targetUserId: string | null;
  action: string;
  method: string | null;
  path: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
};

export type FindActiveParams = {
  tokenHash: string;
  actorUserId: string;
  actorSessionId: string;
  now: Date;
};

export type CreateImpersonationParams = {
  actorUserId: string;
  actorSessionId: string;
  targetUserId: string;
  /** sha256 hex of the token; the raw token is never stored. */
  tokenHash: string;
  reason: string;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
};

/** Which live rows of an actor to end. The actor id is ALWAYS part of the filter. */
export type EndFilter =
  | { by: "id"; id: string; actorUserId: string }
  | { by: "token"; tokenHash: string; actorUserId: string };

// An actor holds one live row; this cap only guards against a runaway loop, never a real limit.
const MAX_LIVE_ROWS_PER_END = 20;

const ROW_SELECT = {
  id: true,
  actor_user_id: true,
  actor_session_id: true,
  target_user_id: true,
  token_hash: true,
  reason: true,
  expires_at: true,
  ended_at: true,
} as const;

/**
 * Find the live impersonation row for this token, bound to this actor AND this actor session.
 *
 * "Live" = not ended and not expired. Binding to the session means a stolen impersonation
 * cookie is useless without the actor's own valid login session.
 *
 * @returns the row, or null when nothing matches
 */
export async function findActiveImpersonation(params: FindActiveParams): Promise<ImpersonationRow | null> {
  const row = await prisma.impersonation_sessions.findFirst({
    where: {
      token_hash: params.tokenHash,
      actor_user_id: params.actorUserId,
      actor_session_id: params.actorSessionId,
      ended_at: null,
      expires_at: { gt: params.now },
    },
    select: ROW_SELECT,
  });
  if (!row) return null;
  return {
    ...row,
    expires_at: row.expires_at.toISOString(),
    ended_at: row.ended_at ? row.ended_at.toISOString() : null,
  };
}

/** Load the target user's eligibility columns (never the password hash). */
export function loadImpersonationTarget(userId: string): Promise<ImpersonationTarget | null> {
  return prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, school_id: true, school_code: true, first_name: true, last_name: true },
  });
}

/**
 * Start a viewing window: end every older live row of this actor and insert the new one,
 * in ONE transaction (one live view per developer; a failed insert leaves the old row alone).
 *
 * @returns the new row's id
 */
export function createImpersonation(params: CreateImpersonationParams): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    await tx.impersonation_sessions.updateMany({
      where: { actor_user_id: params.actorUserId, ended_at: null },
      data: { ended_at: new Date() },
    });
    return tx.impersonation_sessions.create({
      data: {
        actor_user_id: params.actorUserId,
        actor_session_id: params.actorSessionId,
        target_user_id: params.targetUserId,
        token_hash: params.tokenHash,
        reason: params.reason,
        expires_at: params.expiresAt,
        ip_address: params.ip,
        user_agent: params.userAgent,
      },
      select: { id: true },
    });
  });
}

/**
 * End live impersonation rows (set ended_at = now).
 *
 * Each row is flipped with its own compare-and-set (`WHERE id = ? AND ended_at IS NULL`), so
 * only the request that really ended a row gets it back. Ending an ended row is a no-op.
 *
 * @returns the rows THIS call ended (empty when nothing was live)
 */
export async function endImpersonation(
  filter: EndFilter,
  now: Date = new Date(),
): Promise<Array<{ id: string; target_user_id: string }>> {
  const where: Prisma.impersonation_sessionsWhereInput = {
    actor_user_id: filter.actorUserId,
    ended_at: null,
    ...(filter.by === "id" ? { id: filter.id } : { token_hash: filter.tokenHash }),
  };
  const live = await prisma.impersonation_sessions.findMany({
    where,
    select: { id: true, target_user_id: true },
    take: MAX_LIVE_ROWS_PER_END,
  });

  const ended: Array<{ id: string; target_user_id: string }> = [];
  for (const row of live) {
    const result = await prisma.impersonation_sessions.updateMany({
      where: { id: row.id, ended_at: null },
      data: { ended_at: now },
    });
    if (result.count === 1) ended.push(row);
  }
  return ended;
}

/** Append one row to audit_logs. Callers decide whether a failure is fatal (fail closed) or best effort. */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await prisma.audit_logs.create({
    data: {
      school_id: entry.schoolId,
      actor_user_id: entry.actorUserId,
      target_user_id: entry.targetUserId,
      action: entry.action,
      method: entry.method,
      path: entry.path,
      metadata: entry.metadata as Prisma.InputJsonObject,
      ip_address: entry.ip,
      user_agent: entry.userAgent,
    },
    select: { id: true },
  });
}
