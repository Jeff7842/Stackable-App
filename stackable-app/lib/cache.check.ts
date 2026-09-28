// =============================================================================
// Self-check for lib/cache.ts. Run:  pnpm exec tsx lib/cache.check.ts
// -----------------------------------------------------------------------------
// Part A proves that with Redis UNSET the cache is invisible: fn runs every time,
// nothing throws, and exactly one warning is printed.
// Part B uses a fake in-memory Redis (through the __setRedisForTests seam) to
// prove hit / miss / bump / serialisation / failure handling, because the real
// Upstash keys do not exist yet. Exits non-zero on any failure.
// =============================================================================

import assert from "node:assert/strict";

let checks = 0;
const failures: string[] = [];

/** Run one named check; a thrown assertion is recorded, not fatal, so we see every failure. */
async function check(name: string, body: () => Promise<void> | void): Promise<void> {
  checks += 1;
  try {
    await body();
  } catch (err) {
    failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---- capture console.warn so we can count warnings --------------------------
const realWarn = console.warn;
let warnings: string[] = [];
console.warn = (...args: unknown[]) => {
  warnings.push(args.map(String).join(" "));
};

// ---- fake Redis --------------------------------------------------------------
type Fake = {
  store: Map<string, string>;
  ttl: Map<string, number>;
  calls: { get: number; set: number; incr: number };
  fail: { get?: boolean; set?: boolean; incr?: boolean };
  get(key: string): Promise<unknown>;
  set(key: string, value: string, options: { ex: number }): Promise<unknown>;
  incr(key: string): Promise<number>;
};

/**
 * autoParse=true mimics @upstash/redis, which JSON-parses values it reads back
 * (so "3" comes back as the number 3 and our JSON envelope as an object).
 * autoParse=false returns the raw text, like a plain Redis client.
 */
function makeFakeRedis(autoParse: boolean): Fake {
  const fake: Fake = {
    store: new Map(),
    ttl: new Map(),
    calls: { get: 0, set: 0, incr: 0 },
    fail: {},
    async get(key) {
      fake.calls.get += 1;
      if (fake.fail.get) throw new Error("fake redis: get failed");
      const raw = fake.store.get(key);
      if (raw === undefined) return null;
      if (!autoParse) return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return raw; // not JSON: hand back the text, as Upstash does
      }
    },
    async set(key, value, options) {
      fake.calls.set += 1;
      if (fake.fail.set) throw new Error("fake redis: set failed");
      fake.store.set(key, value);
      fake.ttl.set(key, options.ex);
      return "OK";
    },
    async incr(key) {
      fake.calls.incr += 1;
      if (fake.fail.incr) throw new Error("fake redis: incr failed");
      const next = Number(fake.store.get(key) ?? 0) + 1;
      fake.store.set(key, String(next));
      return next;
    },
  };
  return fake;
}

/** A counter wrapper so tests can say "fn was called N times". */
function counted<T>(value: T | (() => T)) {
  const state = { calls: 0 };
  const fn = async (): Promise<T> => {
    state.calls += 1;
    return typeof value === "function" ? (value as () => T)() : value;
  };
  return { fn, state };
}

const BIG = BigInt("9007199254740993"); // > Number.MAX_SAFE_INTEGER, like a phone column
const EPOCH = new Date(0);

async function main(): Promise<void> {
  // The real client must not exist for Part A. Delete BEFORE importing the cache.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const { cached, bumpCache, __setRedisForTests } = await import("./cache");

  // =========================== Part A: Redis unset ===========================
  {
    const original = { big: BIG, when: EPOCH, n: 1 };
    const a = counted(original);

    const first = await cached("school-1", "kpis", 60, a.fn);
    const second = await cached("school-1", "kpis", 60, a.fn);

    await check("A: fn value returned unchanged (same object, BigInt intact)", () => {
      assert.equal(first, original);
      assert.equal(typeof first.big, "bigint");
      assert.equal(first.big, BIG);
      assert.ok(first.when instanceof Date);
    });
    await check("A: nothing cached, so two calls run fn twice", () => {
      assert.equal(second, original);
      assert.equal(a.state.calls, 2);
    });
    await check("A: bumpCache resolves without throwing", async () => {
      await bumpCache("school-1", "students");
      await bumpCache("school-1");
    });
    await check("A: exactly one warning", () => {
      assert.equal(warnings.length, 1, `got ${warnings.length}: ${warnings.join(" | ")}`);
      assert.match(warnings[0] ?? "", /\[cache\]/);
    });
    await check("A: fn errors propagate", async () => {
      await assert.rejects(
        cached("school-1", "boom", 60, async () => {
          throw new Error("fn failed");
        }),
        /fn failed/,
      );
    });
  }

  // ============================ Part B: fake Redis ===========================
  for (const autoParse of [true, false]) {
    const mode = autoParse ? "auto-parse" : "raw-text";
    const redis = makeFakeRedis(autoParse);
    __setRedisForTests(redis);
    warnings = [];

    const sample = () => ({ big: BIG, when: EPOCH, n: 1, nested: { list: [BIG] } });
    const b = counted(sample);

    const miss = await cached("s1", "kpis", 60, b.fn);
    const hit = await cached("s1", "kpis", 60, b.fn);

    await check(`B[${mode}]: miss returns fn's value untouched`, () => {
      assert.equal(typeof miss.big, "bigint");
      assert.ok(miss.when instanceof Date);
    });
    await check(`B[${mode}]: second call is a hit (fn ran once)`, () => {
      assert.equal(b.state.calls, 1);
    });
    await check(`B[${mode}]: hit has BigInt -> string and Date -> ISO string`, () => {
      assert.deepEqual(hit, {
        big: "9007199254740993",
        when: "1970-01-01T00:00:00.000Z",
        n: 1,
        nested: { list: ["9007199254740993"] },
      });
    });
    await check(`B[${mode}]: key format and TTL`, () => {
      assert.ok(redis.store.has("school:s1:v0:kpis"), [...redis.store.keys()].join(","));
      assert.equal(redis.ttl.get("school:s1:v0:kpis"), 60);
    });

    // extraKey / entity / school isolation
    const c = counted("page-2");
    await cached("s1", "kpis", 60, c.fn, "page2");
    await check(`B[${mode}]: extraKey gets its own slot`, () => {
      assert.ok(redis.store.has("school:s1:v0:kpis:page2"));
      assert.equal(c.state.calls, 1);
    });
    const otherSchool = counted("other");
    await cached("s2", "kpis", 60, otherSchool.fn);
    await check(`B[${mode}]: schools never share a cache slot`, () => {
      assert.equal(otherSchool.state.calls, 1);
      assert.ok(redis.store.has("school:s2:v0:kpis"));
    });
    const sepA = counted("A");
    const sepB = counted("B");
    await cached("s1", "a:b", 60, sepA.fn);
    await cached("s1", "a", 60, sepB.fn, "b");
    await check(`B[${mode}]: a ":" in entity cannot collide with extraKey`, () => {
      assert.equal(sepA.state.calls, 1);
      assert.equal(sepB.state.calls, 1);
    });

    // bump invalidates the whole school, not other schools
    await bumpCache("s1", "students");
    await check(`B[${mode}]: bump INCRs the school version`, () => {
      assert.equal(redis.store.get("school:s1:ver"), "1");
    });
    const afterBump = await cached("s1", "kpis", 60, b.fn);
    await check(`B[${mode}]: after bump fn runs again and stores under v1`, () => {
      assert.equal(b.state.calls, 2);
      assert.ok(redis.store.has("school:s1:v1:kpis"));
      assert.equal(afterBump.n, 1);
    });
    await cached("s2", "kpis", 60, otherSchool.fn);
    await check(`B[${mode}]: bumping s1 leaves s2 cached`, () => {
      assert.equal(otherSchool.state.calls, 1);
    });

    // value edge cases
    const nul = counted<null>(null);
    await cached("s1", "nullable", 60, nul.fn);
    const nulHit = await cached("s1", "nullable", 60, nul.fn);
    await check(`B[${mode}]: null is cacheable`, () => {
      assert.equal(nulHit, null);
      assert.equal(nul.state.calls, 1);
    });
    const und = counted<undefined>(undefined);
    await cached("s1", "undef", 60, und.fn);
    await cached("s1", "undef", 60, und.fn);
    await check(`B[${mode}]: undefined is never cached`, () => {
      assert.equal(und.state.calls, 2);
      assert.equal(redis.store.has("school:s1:v1:undef"), false);
    });
    const str = counted("123");
    await cached("s1", "string", 60, str.fn);
    const strHit = await cached("s1", "string", 60, str.fn);
    await check(`B[${mode}]: the string "123" stays a string on a hit`, () => {
      assert.strictEqual(strHit, "123");
      assert.equal(str.state.calls, 1);
    });

    // fn throwing
    const before = redis.store.size;
    await check(`B[${mode}]: fn throws -> error propagates and nothing is stored`, async () => {
      await assert.rejects(
        cached("s1", "throws", 60, async () => {
          throw new Error("db down");
        }),
        /db down/,
      );
      assert.equal(redis.store.size, before);
    });

    // oversize value and bad ttl
    const huge = counted("x".repeat(600 * 1024));
    const hugeResult = await cached("s1", "huge", 60, huge.fn);
    await check(`B[${mode}]: values over ~512KB are returned but not stored`, () => {
      assert.equal(hugeResult.length, 600 * 1024);
      assert.equal(redis.store.has("school:s1:v1:huge"), false);
    });
    const setsBefore = redis.calls.set;
    await cached("s1", "zero-ttl", 0, async () => "v");
    await cached("s1", "nan-ttl", Number.NaN, async () => "v");
    await check(`B[${mode}]: ttl <= 0 or NaN skips the cache entirely`, () => {
      assert.equal(redis.calls.set, setsBefore);
    });
    const noTenant = counted("x");
    await cached("", "kpis", 60, noTenant.fn);
    await cached("", "kpis", 60, noTenant.fn);
    await check(`B[${mode}]: empty schoolId is never cached (no shared bucket)`, () => {
      assert.equal(noTenant.state.calls, 2);
      assert.equal(redis.store.has("school::v0:kpis"), false);
    });

    // corrupted entry
    redis.store.set("school:s1:v1:corrupt", "{not json");
    const corrupt = counted("fresh");
    const corruptResult = await cached("s1", "corrupt", 60, corrupt.fn);
    await check(`B[${mode}]: a corrupt cache entry falls back to fn (one warning)`, () => {
      assert.equal(corruptResult, "fresh");
      assert.equal(corrupt.state.calls, 1);
      assert.equal(warnings.length, 1, `got ${warnings.length}`);
    });
  }

  // ======================= Part C: Redis failing mid-flight ====================
  {
    // reads fail
    const redis = makeFakeRedis(true);
    redis.fail.get = true;
    __setRedisForTests(redis);
    warnings = [];
    const f = counted("v");
    const r1 = await cached("s1", "kpis", 60, f.fn);
    const r2 = await cached("s1", "kpis", 60, f.fn);
    await check("C: get failing -> fn value returned, no throw", () => {
      assert.equal(r1, "v");
      assert.equal(r2, "v");
      assert.equal(f.state.calls, 2);
    });
    await check("C: get failing -> no write attempted, one warning", () => {
      assert.equal(redis.calls.set, 0);
      assert.equal(warnings.length, 1, `got ${warnings.length}`);
    });
  }
  {
    // writes fail
    const redis = makeFakeRedis(false);
    redis.fail.set = true;
    __setRedisForTests(redis);
    warnings = [];
    const f = counted("v");
    const r1 = await cached("s1", "kpis", 60, f.fn);
    const r2 = await cached("s1", "kpis", 60, f.fn);
    await check("C: set failing -> fn value returned, one warning", () => {
      assert.equal(r1, "v");
      assert.equal(r2, "v");
      assert.equal(warnings.length, 1, `got ${warnings.length}`);
    });
  }
  {
    // incr fails
    const redis = makeFakeRedis(true);
    redis.fail.incr = true;
    __setRedisForTests(redis);
    warnings = [];
    await check("C: incr failing -> bumpCache resolves, one warning", async () => {
      await bumpCache("s1");
      await bumpCache("s1");
      assert.equal(warnings.length, 1, `got ${warnings.length}`);
    });
  }
  {
    // value that JSON cannot serialise (circular)
    const redis = makeFakeRedis(true);
    __setRedisForTests(redis);
    warnings = [];
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    const result = await cached("s1", "circular", 60, async () => loop);
    await check("C: unserialisable value is returned, not cached, one warning", () => {
      assert.equal(result, loop);
      assert.equal(redis.store.has("school:s1:v0:circular"), false);
      assert.equal(warnings.length, 1, `got ${warnings.length}`);
    });
  }
  {
    // injected null behaves like "Redis not configured"
    __setRedisForTests(null);
    warnings = [];
    const f = counted("v");
    await cached("s1", "kpis", 60, f.fn);
    await bumpCache("s1");
    await check("C: injected null == unconfigured (fn runs, no warning needed)", () => {
      assert.equal(f.state.calls, 1);
    });
  }

  __setRedisForTests(undefined);
}

main()
  .catch((err) => {
    failures.push(`unexpected crash: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  })
  .finally(() => {
    console.warn = realWarn;
    if (failures.length > 0) {
      console.error(`FAIL lib/cache.check.ts: ${failures.length} of ${checks} checks failed`);
      for (const f of failures) console.error(`  - ${f}`);
      process.exit(1);
    }
    console.log(`PASS lib/cache.check.ts (${checks} checks)`);
  });
