// =============================================================================
// Rate limiting — stop abuse (brute-force logins, API hammering).
// -----------------------------------------------------------------------------
// Backed by Upstash Redis. We define a few named limiters with sensible limits.
// Routes call enforceRateLimit("auth", ip) and get a 429 if the caller is over.
// =============================================================================

import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "./redis";
import { ApiError, serviceUnavailable, tooManyRequests } from "./errors";

export type RateLimitKind = "auth" | "mutation" | "read";

const WINDOWS: Record<RateLimitKind, { tokens: number; window: `${number} ${"s" | "m" | "h"}` }> = {
  // Login / verify-otp: tight, by IP — fixes the old "no lockout" weakness.
  auth: { tokens: 5, window: "15 m" },
  // Writes: generous per user, but stops runaway loops.
  mutation: { tokens: 60, window: "1 m" },
  // Reads: very generous.
  read: { tokens: 240, window: "1 m" },
};

const cache = new Map<RateLimitKind, Ratelimit>();

function getLimiter(kind: RateLimitKind): Ratelimit {
  const existing = cache.get(kind);
  if (existing) return existing;

  const { tokens, window } = WINDOWS[kind];
  const limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix: `rl:${kind}`,
    analytics: false,
  });
  cache.set(kind, limiter);
  return limiter;
}

/**
 * Allow or block a caller. `identifier` should be a stable key — a userId for
 * logged-in actions, or the client IP for anonymous auth attempts.
 * Throws a 429 ApiError when the limit is exceeded.
 */
export async function enforceRateLimit(
  kind: RateLimitKind,
  identifier: string,
): Promise<void> {
  const { success } = await getLimiter(kind).limit(identifier);
  if (!success) throw tooManyRequests();
}

/**
 * Like enforceRateLimit, but a Redis outage is skipped outside production.
 * In production it fails closed (503), so abuse protection is never silently off.
 */
export async function rateLimitOrSkip(kind: RateLimitKind, identifier: string): Promise<void> {
  try {
    await enforceRateLimit(kind, identifier);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (process.env.NODE_ENV === "production") throw serviceUnavailable();
    console.warn(`[ratelimit] skipped (${kind}):`, (err as Error).message);
  }
}
