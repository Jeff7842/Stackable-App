// =============================================================================
// Cache — a tiny "remember this answer for a while" helper on top of Redis.
// -----------------------------------------------------------------------------
// Use it around read-heavy database work (dashboard KPIs, overview lists):
//
//   const kpis = await cached(ctx.schoolId, "kpis", 60, () => loadKpis(ctx.schoolId));
//
// and call bumpCache(ctx.schoolId, "students") after anything that changes that
// school's data. The rules that keep it safe:
//
//   1. Cache-aside. Look in Redis; on a miss run `fn`, store the answer, return it.
//   2. Redis is OPTIONAL. If it is not configured, or ANY Redis/JSON step fails,
//      we quietly run `fn` and return its result. The app behaves exactly as if
//      there were no cache. A cache problem never throws and never blocks a page.
//      One console.warn per process tells you it is happening.
//   3. Invalidation without SCAN/KEYS. Every key contains a per-school version
//      number: `school:{schoolId}:v{n}:{entity}[:{extraKey}]`. The number lives in
//      `school:{schoolId}:ver`. bumpCache() just INCRs it, so every old key for
//      that school is instantly unreachable and expires on its own TTL.
//   4. Nothing is cached when `fn` throws, or when it returns `undefined`.
//
// WHAT COMES BACK ON A HIT: values go through JSON. A BigInt is stored as a
// string and a Date as an ISO string, so a cache HIT returns strings where the
// original had a BigInt or Date. (On a MISS you get `fn`'s value untouched.) Do
// not rely on `instanceof Date` or `typeof x === "bigint"` for cached results;
// convert at the edge of your function if you need to.
// =============================================================================

import { getRedis } from "@/lib/api/redis";

// Skip caching anything larger than this many characters (~512 KB): huge values
// make every hit slow and can exceed Upstash's per-request size limit.
const MAX_VALUE_CHARS = 512 * 1024;

/** The three Redis commands we use. The real Upstash client satisfies this. */
export type CacheRedis = {
  get(key: string): Promise<unknown>;
  set(key: string, value: string, options: { ex: number }): Promise<unknown>;
  incr(key: string): Promise<number>;
};

// Test seam: undefined = use the real client, null = pretend Redis is unset,
// an object = use that fake. Only lib/cache.check.ts sets this.
let injectedRedis: CacheRedis | null | undefined;
let hasWarned = false;

/**
 * Replace the Redis client for tests. Also resets the "warned once" flag so each
 * test starts clean. Pass `undefined` to go back to the real client.
 */
export function __setRedisForTests(client: CacheRedis | null | undefined): void {
  injectedRedis = client;
  hasWarned = false;
}

/** Log a cache problem once per process, so a broken Redis does not flood the logs. */
function warnOnce(what: string, err: unknown): void {
  if (hasWarned) return;
  hasWarned = true;
  const reason = err instanceof Error ? err.message : String(err);
  console.warn(`[cache] ${what} (${reason}). Running without cache; shown once per process.`);
}

/** The Redis client, or null when Redis is not configured. Never throws. */
function tryGetRedis(): CacheRedis | null {
  if (injectedRedis !== undefined) return injectedRedis;
  try {
    return getRedis(); // throws when the UPSTASH_* env vars are missing
  } catch (err) {
    warnOnce("Redis is not available", err);
    return null;
  }
}

// encodeURIComponent turns ":" into "%3A", so a value can never fake a key
// separator and land in another school's or entity's slot.
const part = (value: string): string => encodeURIComponent(value);

const versionKey = (schoolId: string): string => `school:${part(schoolId)}:ver`;

function dataKey(schoolId: string, version: number, entity: string, extraKey?: string): string {
  const base = `school:${part(schoolId)}:v${version}:${part(entity)}`;
  return extraKey ? `${base}:${part(extraKey)}` : base;
}

/** Current version for a school. A missing key means "never bumped" = 0. */
async function readVersion(redis: CacheRedis, schoolId: string): Promise<number> {
  const version = Number(await redis.get(versionKey(schoolId)));
  return Number.isInteger(version) && version >= 0 ? version : 0;
}

// BigInt cannot go through JSON.stringify (it throws), so store it as a string.
// Dates already serialise to ISO strings through their own toJSON().
function bigIntToString(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

// The value is wrapped as {"v": ...} so that `null` is cacheable and so that a
// stored string can never be confused with a miss. Upstash's client may hand
// back the parsed object OR the raw text depending on settings; accept both.
function encode(value: unknown): string {
  return JSON.stringify({ v: value }, bigIntToString);
}

function decode(raw: unknown): unknown {
  const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (typeof parsed !== "object" || parsed === null || !("v" in parsed)) {
    throw new Error("malformed cache entry");
  }
  return (parsed as { v: unknown }).v;
}

/**
 * Return `fn()`'s result, remembering it in Redis for `ttlSeconds`.
 *
 * Why it exists: dashboards re-run the same expensive queries on every page
 * view; this lets many requests share one answer without stale data surviving a
 * write (see bumpCache).
 *
 * @param schoolId   the tenant; cached data is never shared between schools
 * @param entity     what is cached, e.g. "kpis", "students-overview"
 * @param ttlSeconds how long to keep it; also the worst-case staleness if a bump is missed
 * @param fn         computes the value on a miss; if it throws, the error propagates and nothing is cached
 * @param extraKey   optional variant of the entity, e.g. a filter or page cursor
 * @returns the value. On a cache hit, BigInt/Date fields arrive as strings (see top of file).
 * @throws only whatever `fn` throws. Cache failures are swallowed.
 */
export async function cached<T>(
  schoolId: string,
  entity: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
  extraKey?: string,
): Promise<T> {
  // Never cache under an unknown tenant or with a useless TTL: two callers with an
  // empty schoolId would otherwise share one bucket and see each other's data.
  if (!schoolId || !entity || !Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return fn();

  const redis = tryGetRedis();
  if (!redis) return fn();

  // Read the version BEFORE running fn: if a bump lands while fn runs, our result is
  // stored under the now-old version and is simply never read (correct, not stale).
  let key: string | null = null;
  try {
    const version = await readVersion(redis, schoolId);
    const candidateKey = dataKey(schoolId, version, entity, extraKey);
    const hit = await redis.get(candidateKey);
    if (hit !== null && hit !== undefined) return decode(hit) as T;
    key = candidateKey;
  } catch (err) {
    warnOnce("cache read failed", err);
    // key stays null: if reading failed, writing will most likely fail too, and we
    // do not want to pay for a second slow timeout.
  }

  const value = await fn(); // errors here are the caller's, not ours: let them through

  if (key && value !== undefined) {
    try {
      const text = encode(value);
      if (text.length <= MAX_VALUE_CHARS) await redis.set(key, text, { ex: Math.ceil(ttlSeconds) });
    } catch (err) {
      warnOnce("cache write failed", err);
    }
  }
  return value;
}

/**
 * Invalidate cached data after a change.
 *
 * Why it exists: cached answers must not outlive the data they came from.
 *
 * v1 design: invalidation is SCHOOL-WIDE. Bumping the school's version makes every
 * cached entity for that school unreachable at once (they then expire by TTL).
 * `_entity` is accepted so call sites can already say what changed and we can
 * narrow this later without touching them; it is not used yet.
 *
 * @param schoolId the tenant whose cache to invalidate
 * @param _entity  what changed (informational in v1)
 * @returns nothing; never throws. If Redis is down the TTL is the only backstop.
 */
export async function bumpCache(schoolId: string, _entity?: string): Promise<void> {
  void _entity; // accepted for API stability only; see the v1 note above
  if (!schoolId) return;
  const redis = tryGetRedis();
  if (!redis) return;
  try {
    await redis.incr(versionKey(schoolId));
  } catch (err) {
    warnOnce("cache invalidation failed", err);
  }
}
