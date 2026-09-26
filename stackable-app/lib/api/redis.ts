// =============================================================================
// Redis — our fast, in-memory helper (Upstash).
// -----------------------------------------------------------------------------
// We use Redis for three things:
//   1. Storing login sessions (so checking "who is this?" is instant)
//   2. Rate limiting (stopping someone from hammering the login form)
//   3. Caching hot data (e.g. a user's page permissions)
//
// It is LAZY: the connection is only created the first time getRedis() is
// called, so importing this file never crashes when the env isn't set yet.
// =============================================================================

import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/** Get the shared Redis client. Throws a clear error if env is not configured. */
export function getRedis(): Redis {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Redis is not configured. Set UPSTASH_REDIS_REST_URL and " +
        "UPSTASH_REDIS_REST_TOKEN in .env.local (see .env.example).",
    );
  }

  client = new Redis({ url, token });
  return client;
}
