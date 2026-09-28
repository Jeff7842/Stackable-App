// =============================================================================
// Login + password-reset code helpers (server only).
// -----------------------------------------------------------------------------
// - Codes are stored as a KEYED hash (HMAC-SHA256), never as the digits. A 5- or
//   6-digit code has too few values for a plain SHA-256 to protect (100k-1M tries),
//   so the secret key is what makes the stored value useless if the table leaks.
// - After the password step, `login` hands the browser a signed httpOnly
//   "challenge" cookie that names the OTP row. verify-otp / resend-otp read the row
//   from that cookie, so a caller can no longer pick someone else's userId.
// =============================================================================

import crypto from "crypto";
import { ApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/ratelimit";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;
/** login OTP + up to 5 resends inside one OTP window */
export const MAX_OTP_SENDS = 6;
export const MIN_RESEND_GAP_MS = 30 * 1000;
export const OTP_CHALLENGE_COOKIE = "stackable_otp_challenge";

function secret(): string {
  const s = process.env.OTP_HASH_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!s) {
    throw new Error("Set OTP_HASH_SECRET (or BETTER_AUTH_SECRET) so verification codes can be hashed.");
  }
  return s;
}

function hmac(label: string, value: string): string {
  return crypto.createHmac("sha256", secret()).update(`${label}:${value}`).digest("hex");
}

/** Keyed hash of a code, bound to the purpose and the user it was issued to. */
export function hashCode(purpose: "login" | "reset", userId: string, code: string): string {
  return hmac(`code:${purpose}:${userId}`, code);
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Signed, self-expiring token that names one user_otps row. */
export function signChallenge(otpId: string, ttlMs = OTP_TTL_MS): string {
  const payload = Buffer.from(JSON.stringify({ id: otpId, exp: Date.now() + ttlMs })).toString("base64url");
  return `${payload}.${hmac("challenge", payload)}`;
}

/** Returns the OTP row id if the token is genuine and unexpired, else null. */
export function readChallenge(token?: string | null): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, hmac("challenge", payload))) return null;
  try {
    const { id, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof id !== "string" || typeof exp !== "number" || exp < Date.now()) return null;
    return id;
  } catch {
    return null;
  }
}

export function challengeCookieOptions(maxAgeMs = OTP_TTL_MS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth", // only the auth routes ever need it
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

/**
 * Redis rate limit for anonymous auth actions. Throws a 429 ApiError when over the
 * limit; if Redis isn't configured yet it does nothing (the per-code attempt limits
 * in the database still apply).
 */
export async function authLimit(identifier: string): Promise<void> {
  try {
    await enforceRateLimit("auth", identifier);
  } catch (err) {
    if (err instanceof ApiError) throw err;
  }
}
