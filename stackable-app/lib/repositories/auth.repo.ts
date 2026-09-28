// =============================================================================
// Auth repository — every database read/write the login, OTP, session and
// password-reset flows need, on Prisma + plain PostgreSQL (Neon today, your own
// server later; nothing here is host-specific).
// -----------------------------------------------------------------------------
// Two patterns matter for security:
//   * "reserve" / "claim" helpers use updateMany with the value we just READ in
//     the WHERE clause (compare-and-set). Only one of several parallel requests
//     can win, so attempt counters and single-use tokens cannot be raced.
//   * Codes are stored as a keyed hash (see lib/auth/otp.ts); nothing here ever
//     sees or returns the digits.
// Only repositories may import lib/db/prisma.
// =============================================================================

import { prisma } from "@/lib/db/prisma";

const USER_SELECT = {
  id: true,
  school_id: true,
  school_code: true,
  email: true,
  phone: true,
  phone_2: true,
  password_hash: true,
  first_name: true,
  last_name: true,
  role: true,
  status: true,
  must_change_password: true,
} as const;

export type AuthUser = {
  id: string;
  school_id: string;
  school_code: string;
  email: string | null;
  /** Raw bigint from the DB. Pass to resolveSmsPhone() (lib/auth-utils.ts), never send as-is. */
  phone: bigint | null;
  phone_2: bigint | null;
  password_hash: string | null;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  must_change_password: boolean;
};

/** Case-insensitive email match. The same email can exist in more than one school, so this returns a few. */
export function findUsersByEmail(email: string, take = 3): Promise<AuthUser[]> {
  return prisma.users.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    select: USER_SELECT,
    orderBy: { created_at: "asc" },
    take,
  });
}

export function findUserById(id: string): Promise<AuthUser | null> {
  return prisma.users.findUnique({ where: { id }, select: USER_SELECT });
}

// ── Login OTP ────────────────────────────────────────────────────────────────

export type OtpRow = {
  id: string;
  user_id: string;
  otp_code: string;
  attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
  purpose: string;
  created_at: Date;
};

export function countLoginOtpsSince(userId: string, since: Date): Promise<number> {
  return prisma.user_otps.count({
    where: { user_id: userId, purpose: "login", created_at: { gt: since } },
  });
}

/** Retire the user's live codes and store a new one, atomically. Returns the new row id. */
export function issueLoginOtp(input: {
  userId: string;
  schoolCode: string;
  codeHash: string;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    await tx.user_otps.updateMany({
      where: { user_id: input.userId, consumed_at: null },
      data: { consumed_at: new Date() },
    });
    return tx.user_otps.create({
      data: {
        user_id: input.userId,
        school_code: input.schoolCode,
        otp_code: input.codeHash,
        channel: "email",
        purpose: "login",
        expires_at: input.expiresAt,
        ip_address: input.ip,
        user_agent: input.userAgent,
      },
      select: { id: true },
    });
  });
}

export function getOtp(id: string): Promise<OtpRow | null> {
  return prisma.user_otps.findUnique({
    where: { id },
    select: {
      id: true,
      user_id: true,
      otp_code: true,
      attempts: true,
      expires_at: true,
      consumed_at: true,
      purpose: true,
      created_at: true,
    },
  });
}

/** Take one attempt slot. True only if nobody else changed the counter since we read it. */
export async function reserveOtpAttempt(id: string, currentAttempts: number): Promise<boolean> {
  const r = await prisma.user_otps.updateMany({
    where: { id, attempts: currentAttempts, consumed_at: null },
    data: { attempts: { increment: 1 } },
  });
  return r.count === 1;
}

/** Mark a code used. True only for the single request that flips it from live to consumed. */
export async function consumeOtp(id: string): Promise<boolean> {
  const r = await prisma.user_otps.updateMany({
    where: { id, consumed_at: null },
    data: { consumed_at: new Date() },
  });
  return r.count === 1;
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export function createSession(input: {
  userId: string;
  schoolId: string;
  tokenHash: string;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
}) {
  return prisma.user_sessions.create({
    data: {
      user_id: input.userId,
      school_id: input.schoolId,
      session_type: "web",
      refresh_token_hash: input.tokenHash,
      ip_address: input.ip,
      user_agent: input.userAgent,
      expires_at: input.expiresAt,
    },
    select: { id: true },
  });
}

export type SessionWithUser = {
  id: string;
  user_id: string;
  school_id: string;
  users: { role: string; status: string; school_code: string; first_name: string; last_name: string };
};

/** The live (not revoked, not expired) session for a cookie's token hash, with its user. */
export function findLiveSession(tokenHash: string, now: Date): Promise<SessionWithUser | null> {
  return prisma.user_sessions.findFirst({
    where: { refresh_token_hash: tokenHash, revoked_at: null, expires_at: { gt: now } },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      user_id: true,
      school_id: true,
      users: { select: { role: true, status: true, school_code: true, first_name: true, last_name: true } },
    },
  });
}

export async function revokeSessionByTokenHash(tokenHash: string): Promise<void> {
  await prisma.user_sessions.updateMany({
    where: { refresh_token_hash: tokenHash, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

/** `false` only when a row explicitly denies the page; no row means allowed. */
export async function isPageAllowed(userId: string, pageKey: string): Promise<boolean> {
  const row = await prisma.user_page_permissions.findUnique({
    where: { user_id_page_key: { user_id: userId, page_key: pageKey } },
    select: { can_access: true },
  });
  return row ? row.can_access : true;
}

// ── Password reset ───────────────────────────────────────────────────────────

export function findActiveUsersByEmail(email: string) {
  return prisma.users.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, first_name: true, status: true, phone: true, phone_2: true },
    take: 2,
  });
}

/** Creation times of this user's reset codes since `since`, newest first (for send throttling). */
export async function listResetTimesSince(userId: string, since: Date): Promise<Date[]> {
  const rows = await prisma.password_resets.findMany({
    where: { user_id: userId, created_at: { gt: since } },
    orderBy: { created_at: "desc" },
    select: { created_at: true },
  });
  return rows.map((r) => r.created_at);
}

/** One live code per user: retire the old ones and store the new hash, atomically. */
export function issueResetCode(input: {
  userId: string;
  codeHash: string;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.password_resets.updateMany({
      where: { user_id: input.userId, consumed_at: null },
      data: { consumed_at: new Date(), reset_token_hash: null },
    });
    return tx.password_resets.create({
      data: {
        user_id: input.userId,
        code_hash: input.codeHash,
        expires_at: input.expiresAt,
        ip_address: input.ip,
        user_agent: input.userAgent,
      },
      select: { id: true },
    });
  });
}

export function findLiveReset(userId: string, now: Date) {
  return prisma.password_resets.findFirst({
    where: { user_id: userId, consumed_at: null, expires_at: { gt: now } },
    orderBy: { created_at: "desc" },
    select: { id: true, code_hash: true, attempts: true },
  });
}

export async function reserveResetAttempt(id: string, currentAttempts: number): Promise<boolean> {
  const r = await prisma.password_resets.updateMany({
    where: { id, attempts: currentAttempts, consumed_at: null },
    data: { attempts: { increment: 1 } },
  });
  return r.count === 1;
}

export async function killReset(id: string): Promise<void> {
  await prisma.password_resets.updateMany({
    where: { id, consumed_at: null },
    data: { consumed_at: new Date() },
  });
}

/** Burn the code and store the single-use token's hash. True only for the one request that does it. */
export async function issueResetToken(id: string, tokenHash: string, tokenExpiresAt: Date): Promise<boolean> {
  const r = await prisma.password_resets.updateMany({
    where: { id, consumed_at: null },
    data: { consumed_at: new Date(), reset_token_hash: tokenHash, token_expires_at: tokenExpiresAt },
  });
  return r.count === 1;
}

/**
 * Use up a reset token. Returns the user it belongs to, or null if it is unknown, expired or
 * already used. Clearing it in a conditional update makes it single-use even under parallel calls.
 */
export async function claimResetToken(tokenHash: string, now: Date): Promise<string | null> {
  const row = await prisma.password_resets.findFirst({
    where: { reset_token_hash: tokenHash, token_expires_at: { gt: now } },
    select: { id: true, user_id: true },
  });
  if (!row) return null;
  const r = await prisma.password_resets.updateMany({
    where: { id: row.id, reset_token_hash: tokenHash },
    data: { reset_token_hash: null, token_expires_at: null },
  });
  return r.count === 1 ? row.user_id : null;
}

/** New password + sign out everywhere + kill every leftover code, in one transaction. */
export function completePasswordReset(userId: string, passwordHash: string): Promise<void> {
  const now = new Date();
  return prisma
    .$transaction([
      prisma.users.update({
        where: { id: userId },
        data: { password_hash: passwordHash, must_change_password: false, updated_at: now },
      }),
      prisma.user_sessions.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: now } }),
      prisma.user_otps.updateMany({ where: { user_id: userId, consumed_at: null }, data: { consumed_at: now } }),
      prisma.password_resets.updateMany({
        where: { user_id: userId, consumed_at: null },
        data: { consumed_at: now, reset_token_hash: null },
      }),
    ])
    .then(() => undefined);
}
