// =============================================================================
// Self-check for impersonation. Run:  pnpm exec tsx lib/api/impersonation.check.ts
// -----------------------------------------------------------------------------
// No database queries, no network, no dev server (importing the code loads the Prisma
// client module, which does not connect until a query runs). It walks every branch of
// the security rules with stubs:
//   1. pure helpers   cookie flags, tokens, reason, target eligibility, IP/UA/path
//                     sanitising, same-origin, missing-table detection, safe error labels
//   2. fail-closed    enforceAudit() (the function requireAuth uses) with stub writers
//   3. the rulebook   decideImpersonation() - one check per rule, in rule order
//   4. resolution     resolveImpersonation() with stub deps: role is checked BEFORE any
//                     table is touched, and every failure returns null (the real user)
//   5. dev console    query parsing, search/LIKE cleaning + escaping, date bounds, body schema
//   6. architecture   no file of this lane imports Supabase, and only repositories import Prisma
// Prints PASS/FAIL per section and exits 1 on any failure.
// =============================================================================

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  AUDIT_UNAVAILABLE_MESSAGE,
  IMPERSONATION_COOKIE,
  IMPERSONATION_TTL_SECONDS,
  TABLES_MISSING_MESSAGE,
  __resetWarnedForTests,
  clearedImpersonationCookieOptions,
  decideImpersonation,
  describeRequest,
  enforceAudit,
  generateImpersonationToken,
  hashImpersonationToken,
  impersonationCookieOptions,
  isEligibleTarget,
  isMissingTableError,
  isPlausibleToken,
  isReadMethod,
  pathnameOnly,
  resolveImpersonation,
  safeErrorLabel,
  sameOriginOk,
  sanitizeIp,
  sanitizeUserAgent,
  tablesNotInstalled,
  validateReason,
  type DecideInput,
  type ImpersonationDeps,
  type ImpersonationRow,
  type ImpersonationTarget,
  type RealActor,
} from "./impersonation";
import { ApiError } from "./errors";

// ---- tiny harness -------------------------------------------------------------
type Section = { total: number; failed: string[] };
const sections = new Map<string, Section>();
let current: Section = { total: 0, failed: [] };

function section(name: string): void {
  current = { total: 0, failed: [] };
  sections.set(name, current);
}

/** Run one named check; a failed assertion is recorded (not fatal) so every failure is shown. */
async function check(name: string, body: () => Promise<void> | void): Promise<void> {
  current.total += 1;
  try {
    await body();
  } catch (err) {
    current.failed.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Capture console output: the code under test logs on purpose (once-only warnings, audit errors).
const realWarn = console.warn;
const realError = console.error;
let warnings: string[] = [];
let errors: string[] = [];
console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(" "));
console.error = (...args: unknown[]) => void errors.push(args.map(String).join(" "));
function resetLogs(): void {
  warnings = [];
  errors = [];
  __resetWarnedForTests();
}

// ---- fixtures -----------------------------------------------------------------
const NOW = new Date("2026-09-26T12:00:00.000Z");
const FUTURE = "2026-09-26T12:30:00.000Z";
const ACTOR: RealActor = { userId: "actor-1", role: "super-admin", sessionId: "sess-1", name: "Dev Person" };
const TEACHER: ImpersonationTarget = {
  id: "teacher-1",
  role: "teacher",
  status: "active",
  school_id: "school-1",
  school_code: "SCH1",
  first_name: "Tina",
  last_name: "Teacher",
};

function makeRow(token: string, over: Partial<ImpersonationRow> = {}): ImpersonationRow {
  return {
    id: "row-1",
    actor_user_id: ACTOR.userId,
    actor_session_id: ACTOR.sessionId as string,
    target_user_id: TEACHER.id,
    token_hash: hashImpersonationToken(token),
    reason: "Investigating a timetable bug",
    expires_at: FUTURE,
    ended_at: null,
    ...over,
  };
}

const req = (url: string, headers: Record<string, string> = {}) => ({ url, headers: new Headers(headers) });

/** What Prisma throws (shape only): a named error with a P-code. The message deliberately holds "secrets". */
function prismaError(code: string, message = "Invalid `prisma.x.create()` invocation: token_hash = SECRETHASH"): Error {
  return Object.assign(new Error(message), { name: "PrismaClientKnownRequestError", code });
}

// =============================================================================
async function main(): Promise<void> {
  // ---------------------------------------------------------------------------
  section("1a cookie options");
  await check("production flags", () => {
    assert.deepEqual(impersonationCookieOptions("production"), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 3600,
    });
  });
  await check("development is not secure (http://localhost)", () => {
    assert.equal(impersonationCookieOptions("development").secure, false);
    assert.equal(impersonationCookieOptions("test").secure, false);
    assert.equal(impersonationCookieOptions(undefined).secure, false);
    assert.equal(impersonationCookieOptions("development").httpOnly, true);
  });
  await check("ttl is exactly one hour", () => assert.equal(IMPERSONATION_TTL_SECONDS, 3600));
  await check("cleared cookie: same flags, maxAge 0", () => {
    const live = impersonationCookieOptions("production");
    const dead = clearedImpersonationCookieOptions("production");
    assert.equal(dead.maxAge, 0);
    assert.deepEqual({ ...dead, maxAge: 1 }, { ...live, maxAge: 1 });
  });
  await check("cookie name", () => assert.equal(IMPERSONATION_COOKIE, "stackable_impersonation"));

  // ---------------------------------------------------------------------------
  section("1b token generation");
  await check("length, alphabet, hash shape", () => {
    const { token, tokenHash } = generateImpersonationToken();
    assert.equal(token.length, 43);
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.match(tokenHash, /^[0-9a-f]{64}$/);
    assert.notEqual(tokenHash, token);
  });
  await check("hash is sha256 hex of the token", () => {
    const { token, tokenHash } = generateImpersonationToken();
    assert.equal(tokenHash, createHash("sha256").update(token).digest("hex"));
    assert.equal(hashImpersonationToken(token), tokenHash);
  });
  await check("500 tokens are unique", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generateImpersonationToken().token);
    assert.equal(seen.size, 500);
  });
  await check("isPlausibleToken accepts generated, rejects junk", () => {
    assert.ok(isPlausibleToken(generateImpersonationToken().token));
    for (const bad of ["", "short", "a".repeat(42), "a".repeat(44), "a".repeat(42) + "+", "a".repeat(42) + " ", undefined, null]) {
      assert.equal(isPlausibleToken(bad as string | null | undefined), false, JSON.stringify(bad));
    }
  });

  // ---------------------------------------------------------------------------
  section("1c reason validation");
  const okReason = (v: unknown) => {
    const r = validateReason(v);
    assert.ok(r.ok, `expected ok for ${JSON.stringify(v)}`);
    return r.value;
  };
  const badReason = (v: unknown) => assert.equal(validateReason(v).ok, false, `expected rejection for ${JSON.stringify(v)}`);
  await check("length boundaries 9/10/500/501", () => {
    badReason("a".repeat(9));
    okReason("a".repeat(10));
    okReason("a".repeat(500));
    badReason("a".repeat(501));
  });
  await check("whitespace-only and padded", () => {
    badReason(" ".repeat(10));
    badReason("\n\t \n\t \n\t ");
    badReason("  " + "a".repeat(9) + "  "); // 9 real chars
    assert.equal(okReason("  " + "a".repeat(10) + "  "), "a".repeat(10));
  });
  await check("non-strings", () => {
    for (const bad of [undefined, null, 12345678901, {}, ["aaaaaaaaaa"]]) badReason(bad);
  });
  await check("NUL / control characters and half surrogates never reach the database", () => {
    assert.equal(okReason("abcde\u0000fghij"), "abcdefghij");
    badReason("\u0000".repeat(20));
    badReason("a".repeat(9) + "\ud800"); // lone surrogate is dropped: 9 chars left
    assert.equal(okReason("line one\nline two"), "line one\nline two"); // newline is fine
  });

  // ---------------------------------------------------------------------------
  section("1d target eligibility");
  const actor = { id: "actor-1" };
  const t = (over: Partial<ImpersonationTarget> = {}) => ({ ...TEACHER, ...over });
  await check("valid roles are eligible", () => {
    for (const role of ["teacher", "parent", "student", "pupil", "staff", "admin", "manager"]) {
      assert.equal(isEligibleTarget(actor, t({ role })), true, role);
    }
  });
  await check("self, super-admin, suspended, pending, missing", () => {
    assert.equal(isEligibleTarget(actor, t({ id: "actor-1" })), false);
    assert.equal(isEligibleTarget(actor, t({ id: "ACTOR-1" })), false); // case-insensitive self check
    assert.equal(isEligibleTarget(actor, t({ role: "super-admin" })), false);
    assert.equal(isEligibleTarget(actor, t({ status: "suspended" })), false);
    assert.equal(isEligibleTarget(actor, t({ status: "pending" })), false);
    assert.equal(isEligibleTarget(actor, t({ status: null })), false);
    assert.equal(isEligibleTarget(actor, null), false);
    assert.equal(isEligibleTarget(actor, undefined), false);
  });
  await check("unknown role and missing school", () => {
    assert.equal(isEligibleTarget(actor, t({ role: "hacker" })), false);
    assert.equal(isEligibleTarget(actor, t({ role: "Super-Admin" })), false);
    assert.equal(isEligibleTarget(actor, t({ role: null })), false);
    assert.equal(isEligibleTarget(actor, t({ school_id: null })), false);
    assert.equal(isEligibleTarget(actor, t({ school_id: "" })), false);
  });

  // ---------------------------------------------------------------------------
  section("1e sanitizeIp (audit ip_address is a Postgres inet column)");
  await check("valid addresses pass", () => {
    assert.equal(sanitizeIp("203.0.113.7"), "203.0.113.7");
    assert.equal(sanitizeIp("2001:db8::1"), "2001:db8::1");
    assert.equal(sanitizeIp("::1"), "::1");
    assert.equal(sanitizeIp("::ffff:1.2.3.4"), "::ffff:1.2.3.4");
    assert.equal(sanitizeIp("  1.2.3.4  "), "1.2.3.4");
  });
  await check("only the FIRST hop counts", () => {
    assert.equal(sanitizeIp("1.2.3.4, 5.6.7.8"), "1.2.3.4");
    assert.equal(sanitizeIp("1.2.3.4, evil"), "1.2.3.4"); // first hop is valid; the rest is ignored
    assert.equal(sanitizeIp("evil, 1.2.3.4"), null); // garbage first hop is NOT skipped past
  });
  await check("garbage and injection strings become null", () => {
    const bad = [
      "", "   ", "evil", "999.1.1.1", "1.2.3", "1.2.3.4.5", "1.2.3.4:8080", "[::1]", "fe80::1%eth0",
      "1.2.3.4\r\nX-Injected: 1", "1.2.3.4\nSet-Cookie: a=b", "1.2.3.4; DROP TABLE audit_logs", "' OR 1=1 --",
      "0x7f.0.0.1", "1.2.3.4\u0000", "::g", "a".repeat(200), "1.2.3.4 evil", "<script>alert(1)</script>",
    ];
    for (const value of bad) assert.equal(sanitizeIp(value), null, JSON.stringify(value));
    assert.equal(sanitizeIp(null), null);
    assert.equal(sanitizeIp(undefined), null);
  });

  // ---------------------------------------------------------------------------
  section("1f user agent, path, method, same-origin");
  await check("sanitizeUserAgent truncates and cleans", () => {
    assert.equal(sanitizeUserAgent(null), null);
    assert.equal(sanitizeUserAgent(""), null);
    assert.equal(sanitizeUserAgent("   "), null);
    assert.equal(sanitizeUserAgent("a".repeat(300))?.length, 300);
    assert.equal(sanitizeUserAgent("a".repeat(301))?.length, 300);
    assert.equal(sanitizeUserAgent("a".repeat(5000))?.length, 300);
    assert.equal(sanitizeUserAgent("Mozilla\u0000/5.0\r\n"), "Mozilla/5.0");
    // An emoji cut in half by the truncation must not leave a lone surrogate behind.
    const cut = sanitizeUserAgent("a".repeat(299) + "\u{1F600}") as string;
    assert.equal(cut.length, 299);
    assert.equal(/[\ud800-\udfff]/.test(cut), false);
  });
  await check("pathnameOnly drops the query string and fragment", () => {
    assert.equal(pathnameOnly("https://x.test/api/admin/users?token=SECRET&id=1#frag"), "/api/admin/users");
    assert.equal(pathnameOnly("/api/a?x=1"), "/api/a");
    assert.equal(pathnameOnly("http://x.test"), "/");
    assert.equal(pathnameOnly("http://"), null);
    assert.equal(pathnameOnly("/" + "a".repeat(600))?.length, 500);
    assert.equal(pathnameOnly("/api/a%00b?x=1"), "/api/a%00b"); // stays percent-encoded text, never a raw NUL
    assert.ok(!(pathnameOnly("https://x.test/p?secret=1") ?? "").includes("secret"));
  });
  await check("describeRequest combines the sanitisers", () => {
    const d = describeRequest(req("https://x.test/api/a?k=v", { "x-forwarded-for": "1.2.3.4, 9.9.9.9", "user-agent": "UA/1" }));
    assert.deepEqual(d, { ip: "1.2.3.4", userAgent: "UA/1", path: "/api/a" });
    const bad = describeRequest(req("https://x.test/x", { "x-forwarded-for": "not-an-ip" }));
    assert.equal(bad.ip, null);
    assert.equal(bad.userAgent, null);
  });
  await check("isReadMethod", () => {
    for (const m of ["GET", "HEAD", "OPTIONS", "get"]) assert.equal(isReadMethod(m), true, m);
    for (const m of ["POST", "PUT", "PATCH", "DELETE", "post"]) assert.equal(isReadMethod(m), false, m);
  });
  await check("sameOriginOk", () => {
    const url = "https://app.test/api/dev/impersonate/start";
    assert.equal(sameOriginOk(req(url)), true); // no Origin header: allowed
    assert.equal(sameOriginOk(req(url, { origin: "https://app.test" })), true);
    assert.equal(sameOriginOk(req(url, { origin: "https://evil.test" })), false);
    assert.equal(sameOriginOk(req(url, { origin: "http://app.test" })), false); // scheme differs
    assert.equal(sameOriginOk(req(url, { origin: "https://app.test:8443" })), false); // port differs
    assert.equal(sameOriginOk(req(url, { origin: "https://app.test.evil.test" })), false);
    assert.equal(sameOriginOk(req(url, { origin: "null" })), false); // sandboxed iframe / file:
    assert.equal(sameOriginOk(req(url, { origin: "" })), false);
    assert.equal(sameOriginOk(req("not a url", { origin: "https://app.test" })), false);
    assert.equal(sameOriginOk(req("http://localhost:3000/x", { origin: "http://localhost:3000" })), true);
  });
  await check("isMissingTableError knows Prisma / PostgreSQL codes only", () => {
    assert.equal(isMissingTableError(prismaError("P2021")), true); // table does not exist
    assert.equal(isMissingTableError(prismaError("P2022")), true); // column does not exist (migrations behind)
    assert.equal(isMissingTableError({ code: "42P01" }), true); // PostgreSQL SQLSTATE undefined_table
    assert.equal(isMissingTableError({ code: "P2010", meta: { code: "42P01" } }), true); // raw query, missing relation
    for (const other of [
      prismaError("P2002"), // unique constraint
      prismaError("P2025"),
      { code: "P2010", meta: { code: "23505" } },
      { code: "P2010" },
      { code: "PGRST205" }, // the old PostgREST code is not special any more
      { message: 'relation "public.audit_logs" does not exist' }, // message text is never inspected
      { message: "timeout" },
      null,
      undefined,
      "boom",
      42,
    ]) {
      assert.equal(isMissingTableError(other), false, JSON.stringify(other));
    }
  });
  await check("tablesNotInstalled is a 503 that says how to fix it", () => {
    const e = tablesNotInstalled();
    assert.ok(e instanceof ApiError);
    assert.equal(e.status, 503);
    assert.equal(e.message, "Impersonation tables are not installed. Run the database migrations (pnpm db:deploy).");
    assert.equal(e.message, TABLES_MISSING_MESSAGE);
  });
  await check("safeErrorLabel never contains the error message", () => {
    const err = prismaError("P2002");
    const label = safeErrorLabel(err);
    assert.equal(label, "PrismaClientKnownRequestError P2002");
    assert.ok(!label.includes("SECRETHASH") && !label.includes("invocation"));
    assert.equal(safeErrorLabel(new Error("secret text")), "Error");
    assert.equal(safeErrorLabel("a secret string"), "non-object error");
    assert.equal(safeErrorLabel(null), "non-object error");
    // a "code" that is not a short identifier is ignored (it could carry data)
    assert.equal(safeErrorLabel(Object.assign(new Error("x"), { code: "token_hash=abc def ghi jkl" })), "Error");
  });

  // ---------------------------------------------------------------------------
  section("2 audit fail-closed (enforceAudit)");
  await check("resolves when the writer resolves", async () => {
    resetLogs();
    let calls = 0;
    await enforceAudit(async () => {
      calls += 1;
    });
    assert.equal(calls, 1);
    assert.equal(errors.length, 0);
  });
  await check("writer rejects -> ApiError 500 'Audit log unavailable'", async () => {
    resetLogs();
    await assert.rejects(
      () => enforceAudit(async () => Promise.reject(prismaError("P1001", "Can't reach database server at secret-host:5432"))),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 500);
        assert.equal(err.message, AUDIT_UNAVAILABLE_MESSAGE);
        assert.equal(err.code, "AUDIT_UNAVAILABLE");
        assert.ok(!err.message.includes("secret-host")); // the cause is never returned...
        return true;
      },
    );
    // ...and only its class + code reach the log: a Prisma message can echo hashes, IPs and host names.
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes("PrismaClientKnownRequestError P1001"));
    assert.ok(!errors[0].includes("secret-host") && !errors[0].includes("SECRETHASH"), errors[0]);
  });
  await check("synchronous throw, non-Error rejection, and ApiError are all 500", async () => {
    resetLogs();
    const writers: Array<() => Promise<void>> = [
      (() => {
        throw new Error("sync");
      }) as () => Promise<void>,
      () => Promise.reject("just a string"),
      () => Promise.reject(new ApiError(403, "nope")),
      () => Promise.reject(prismaError("P2021")), // even "table missing" is a 500 here (fail closed)
    ];
    for (const writer of writers) {
      await assert.rejects(
        () => enforceAudit(writer),
        (err: unknown) => err instanceof ApiError && err.status === 500 && err.message === AUDIT_UNAVAILABLE_MESSAGE,
      );
    }
  });
  await check("a failed audit means the handler is never reached (requireAuth pattern)", async () => {
    resetLogs();
    let handlerRan = false;
    const guardThenHandler = async () => {
      await enforceAudit(async () => Promise.reject(new Error("db down")));
      handlerRan = true; // must not be reached
    };
    await assert.rejects(guardThenHandler);
    assert.equal(handlerRan, false);
  });

  // ---------------------------------------------------------------------------
  section("3 decideImpersonation (the rulebook)");
  const TOKEN = generateImpersonationToken().token;
  const validInput = (over: Partial<DecideInput> = {}): DecideInput => ({
    actor: { userId: ACTOR.userId, role: "super-admin", sessionId: ACTOR.sessionId },
    cookiePresent: true,
    cookieHash: hashImpersonationToken(TOKEN),
    row: makeRow(TOKEN),
    target: TEACHER,
    now: NOW,
    ...over,
  });
  const expectSkip = (input: DecideInput, reason: string) => {
    const d = decideImpersonation(input);
    assert.deepEqual(d, { mode: "actor", reason });
  };
  await check("everything valid -> target", () => assert.deepEqual(decideImpersonation(validInput()), { mode: "target" }));
  await check("no cookie -> actor", () => expectSkip(validInput({ cookiePresent: false }), "no-cookie"));
  await check("role is checked before anything about the row", () => {
    expectSkip(validInput({ actor: { userId: "u", role: "admin", sessionId: "s" } }), "not-super-admin");
    expectSkip(validInput({ actor: { userId: "u", role: "teacher", sessionId: "s" }, row: null }), "not-super-admin");
    expectSkip(validInput({ actor: { userId: "u", role: "", sessionId: "s" } }), "not-super-admin");
    expectSkip(validInput({ actor: { userId: "u", role: "Super-Admin", sessionId: "s" } }), "not-super-admin");
  });
  await check("malformed cookie / no row / wrong token", () => {
    expectSkip(validInput({ cookieHash: null }), "malformed-cookie");
    expectSkip(validInput({ row: null }), "no-active-row");
    expectSkip(validInput({ row: makeRow(TOKEN, { token_hash: hashImpersonationToken("other") }) }), "token-mismatch");
  });
  await check("ended and expired rows", () => {
    expectSkip(validInput({ row: makeRow(TOKEN, { ended_at: "2026-09-26T11:00:00.000Z" }) }), "row-ended");
    expectSkip(validInput({ row: makeRow(TOKEN, { expires_at: NOW.toISOString() }) }), "row-expired"); // boundary: exactly now
    expectSkip(validInput({ row: makeRow(TOKEN, { expires_at: "2026-09-26T11:59:59.999Z" }) }), "row-expired");
    expectSkip(validInput({ row: makeRow(TOKEN, { expires_at: "not a date" }) }), "row-expired"); // unparsable = expired
    assert.deepEqual(
      decideImpersonation(validInput({ row: makeRow(TOKEN, { expires_at: "2026-09-26T12:00:00.001Z" }) })),
      { mode: "target" },
    );
  });
  await check("row must belong to THIS actor and THIS login session", () => {
    expectSkip(validInput({ row: makeRow(TOKEN, { actor_user_id: "someone-else" }) }), "actor-mismatch");
    expectSkip(validInput({ row: makeRow(TOKEN, { actor_session_id: "old-session" }) }), "session-mismatch");
    expectSkip(validInput({ row: makeRow(TOKEN, { actor_session_id: null }) }), "session-mismatch");
    expectSkip(validInput({ actor: { userId: ACTOR.userId, role: "super-admin", sessionId: undefined } }), "session-mismatch");
  });
  await check("target must exist, match the row, and be eligible", () => {
    expectSkip(validInput({ target: null }), "target-missing");
    expectSkip(validInput({ target: { ...TEACHER, id: "different" } }), "target-mismatch");
    expectSkip(validInput({ target: { ...TEACHER, role: "super-admin" } }), "target-ineligible");
    expectSkip(validInput({ target: { ...TEACHER, status: "suspended" } }), "target-ineligible");
    expectSkip(validInput({ target: { ...TEACHER, school_id: null } }), "target-ineligible");
    // the row points at the actor themself (should be impossible, but must still be refused)
    expectSkip(
      validInput({ row: makeRow(TOKEN, { target_user_id: ACTOR.userId }), target: { ...TEACHER, id: ACTOR.userId } }),
      "target-ineligible",
    );
  });

  // ---------------------------------------------------------------------------
  section("4 resolveImpersonation (stub deps, fail safe)");
  type Spy = { deps: ImpersonationDeps; findCalls: unknown[]; loadCalls: string[] };
  function makeSpy(opts: { row?: ImpersonationRow | null; target?: ImpersonationTarget | null; findThrows?: unknown; loadThrows?: unknown }): Spy {
    const spy: Spy = {
      findCalls: [],
      loadCalls: [],
      deps: {
        async findActive(params) {
          spy.findCalls.push(params);
          if (opts.findThrows !== undefined) throw opts.findThrows;
          return opts.row ?? null;
        },
        async loadTarget(userId) {
          spy.loadCalls.push(userId);
          if (opts.loadThrows !== undefined) throw opts.loadThrows;
          return opts.target ?? null;
        },
      },
    };
    return spy;
  }
  const goodRow = makeRow(TOKEN);

  await check("no cookie -> null and NO table is read", async () => {
    const spy = makeSpy({ row: goodRow, target: TEACHER });
    assert.equal(await resolveImpersonation(ACTOR, undefined, spy.deps, NOW), null);
    assert.equal(await resolveImpersonation(ACTOR, "", spy.deps, NOW), null);
    assert.equal(spy.findCalls.length + spy.loadCalls.length, 0);
  });
  await check("non-super-admin with a valid-looking cookie -> null and NO table is read", async () => {
    for (const role of ["admin", "manager", "teacher", "parent", "student", "pupil", "staff", "", "SUPER-ADMIN"]) {
      const spy = makeSpy({ row: goodRow, target: TEACHER });
      assert.equal(await resolveImpersonation({ ...ACTOR, role }, TOKEN, spy.deps, NOW), null, role);
      assert.equal(spy.findCalls.length + spy.loadCalls.length, 0, `table read for role "${role}"`);
    }
  });
  await check("malformed cookie or missing session id -> null and NO table is read", async () => {
    const spy = makeSpy({ row: goodRow, target: TEACHER });
    assert.equal(await resolveImpersonation(ACTOR, "garbage", spy.deps, NOW), null);
    assert.equal(await resolveImpersonation(ACTOR, "a".repeat(43) + "!", spy.deps, NOW), null);
    assert.equal(await resolveImpersonation({ ...ACTOR, sessionId: undefined }, TOKEN, spy.deps, NOW), null);
    assert.equal(spy.findCalls.length + spy.loadCalls.length, 0);
  });
  await check("happy path returns the TARGET identity plus the actor", async () => {
    resetLogs();
    const spy = makeSpy({ row: goodRow, target: TEACHER });
    const r = await resolveImpersonation(ACTOR, TOKEN, spy.deps, NOW);
    assert.ok(r);
    assert.deepEqual(r.identity, { userId: "teacher-1", schoolId: "school-1", schoolCode: "SCH1", role: "teacher" });
    assert.deepEqual(r.impersonatedBy, {
      id: "actor-1",
      name: "Dev Person",
      role: "super-admin",
      reason: "Investigating a timetable bug",
      expiresAt: FUTURE,
      sessionRowId: "row-1",
    });
    // The database is asked with the HASH, bound to this actor and session; the raw token never leaves.
    assert.equal(spy.findCalls.length, 1);
    const params = spy.findCalls[0] as { tokenHash: string; actorUserId: string; actorSessionId: string };
    assert.equal(params.tokenHash, hashImpersonationToken(TOKEN));
    assert.notEqual(params.tokenHash, TOKEN);
    assert.equal(params.actorUserId, "actor-1");
    assert.equal(params.actorSessionId, "sess-1");
    assert.deepEqual(spy.loadCalls, ["teacher-1"]);
    assert.equal(warnings.length, 0);
  });
  await check("no live row -> null", async () => {
    resetLogs();
    assert.equal(await resolveImpersonation(ACTOR, TOKEN, makeSpy({ row: null }).deps, NOW), null);
  });
  await check("expired / ended / other-session rows -> null even if the database returned them", async () => {
    resetLogs();
    for (const over of [{ expires_at: "2026-09-26T11:00:00.000Z" }, { ended_at: "2026-09-26T11:00:00.000Z" }, { actor_session_id: "old" }, { actor_user_id: "x" }]) {
      const spy = makeSpy({ row: makeRow(TOKEN, over), target: TEACHER });
      assert.equal(await resolveImpersonation(ACTOR, TOKEN, spy.deps, NOW), null, JSON.stringify(over));
    }
  });
  await check("target that became a super-admin / suspended -> null", async () => {
    resetLogs();
    for (const over of [{ role: "super-admin" }, { status: "suspended" }]) {
      const spy = makeSpy({ row: goodRow, target: { ...TEACHER, ...over } });
      assert.equal(await resolveImpersonation(ACTOR, TOKEN, spy.deps, NOW), null, JSON.stringify(over));
    }
  });
  await check("ANY dependency error -> null (fails safe to the actor), never throws", async () => {
    resetLogs();
    const failures: Array<Parameters<typeof makeSpy>[0]> = [
      { findThrows: new Error("network down") },
      { findThrows: "a string" },
      { findThrows: prismaError("P2021") },
      { findThrows: prismaError("P1001", "Can't reach database server at secret-host:5432") },
      { row: goodRow, loadThrows: new Error("users unreachable") },
    ];
    for (const f of failures) {
      const r = await resolveImpersonation(ACTOR, TOKEN, makeSpy(f).deps, NOW);
      assert.equal(r, null);
    }
  });
  await check("warnings are once per failure kind and contain no secrets", async () => {
    resetLogs();
    const secretHash = hashImpersonationToken(TOKEN);
    for (let i = 0; i < 5; i++) {
      await resolveImpersonation(ACTOR, TOKEN, makeSpy({ findThrows: prismaError("P1001", `Can't reach ${secretHash}`) }).deps, NOW);
    }
    for (let i = 0; i < 5; i++) {
      await resolveImpersonation(ACTOR, TOKEN, makeSpy({ findThrows: prismaError("P2021") }).deps, NOW);
    }
    assert.equal(warnings.length, 2, `expected 2 warnings (one per kind), got ${warnings.length}: ${warnings.join(" | ")}`);
    assert.ok(warnings.some((w) => w.includes("tables missing")));
    assert.ok(warnings.some((w) => w.includes("PrismaClientKnownRequestError P1001")));
    for (const w of warnings) {
      // The Prisma MESSAGE (which echoed the hash above) must never reach the log.
      assert.ok(!w.includes(TOKEN) && !w.includes(secretHash) && !w.includes("actor-1") && !w.includes("SECRETHASH"), `warning leaks data: ${w}`);
    }
  });

  // ---------------------------------------------------------------------------
  section("5 developer console helpers (lib/dev-server.ts)");
  // Importing dev-server loads the Prisma client module but runs no query (nothing connects).
  const dev = await import("../dev-server");
  const { escapeLike } = await import("../repositories/dev-console.repo");

  await check("sanitizeSearchTerm: control chars, whitespace, length (Prisma binds the text as a parameter)", () => {
    assert.equal(dev.sanitizeSearchTerm("  a \n\t  b  "), "a b");
    assert.equal(dev.sanitizeSearchTerm("a\u0000b\u0007c"), "abc"); // NUL would make PostgreSQL reject the statement
    assert.equal(dev.sanitizeSearchTerm("x".repeat(500)).length, 80);
    assert.equal(dev.sanitizeSearchTerm("a".repeat(79) + "\u{1F600}"), "a".repeat(79)); // a half emoji is dropped
    assert.equal(dev.sanitizeSearchTerm("jane.doe+tag@school.co.ke"), "jane.doe+tag@school.co.ke"); // e-mail survives
    assert.equal(dev.sanitizeSearchTerm("Wanjirû O'Brien-Kamau"), "Wanjirû O'Brien-Kamau"); // real names survive
    assert.equal(dev.sanitizeSearchTerm(""), "");
    assert.equal(dev.sanitizeSearchTerm("   "), "");
    assert.equal(dev.sanitizeSearchTerm(null), "");
    assert.equal(dev.sanitizeSearchTerm(undefined), "");
  });
  await check("searchTokens caps the number of words", () => {
    assert.deepEqual(dev.searchTokens("jane doe"), ["jane", "doe"]);
    assert.equal(dev.searchTokens("a b c d e f g").length, 4);
    assert.deepEqual(dev.searchTokens(""), []);
  });
  await check("escapeLike: % _ and backslash match literally (Prisma does not escape them)", () => {
    assert.equal(escapeLike("a_b%c\\d"), "a\\_b\\%c\\\\d");
    assert.equal(escapeLike("impersonation."), "impersonation.");
    assert.equal(escapeLike("100%"), "100\\%");
    assert.equal(escapeLike("\\"), "\\\\"); // a lone backslash can no longer be a broken escape
    assert.equal(escapeLike(""), "");
  });
  await check("parseDateBoundary: bare dates are inclusive", () => {
    assert.equal(dev.parseDateBoundary("2026-09-26", "start"), "2026-09-26T00:00:00.000Z");
    assert.equal(dev.parseDateBoundary("2026-09-26", "end"), "2026-09-26T23:59:59.999Z");
    assert.equal(dev.parseDateBoundary("2026-09-26T10:00:00Z", "end"), "2026-09-26T10:00:00.000Z");
    assert.equal(dev.parseDateBoundary("2026-09-26T10:00:00+03:00", "start"), "2026-09-26T07:00:00.000Z");
    for (const bad of ["2026-02-31", "yesterday", "2026-09-26T10:00:00", "26/09/2026", "", "2026-13-01", "2026-09-26; DROP"]) {
      assert.equal(dev.parseDateBoundary(bad, "start"), null, bad);
    }
  });
  await check("users query: enums, ids, clamping, garbage", () => {
    const s = dev.usersQuerySchema;
    assert.ok(s.safeParse({ role: "teacher", status: "active", schoolId: "123e4567-e89b-42d3-a456-426614174000" }).success);
    for (const bad of [{ role: "root" }, { role: "TEACHER" }, { status: "deleted" }, { schoolId: "not-a-uuid" }, { schoolId: "1 OR 1=1" }, { q: "x".repeat(201) }, { page: "abc" }, { page: "-1" }, { pageSize: "1e3" }, { pageSize: "12.5" }]) {
      assert.equal(s.safeParse(bad).success, false, JSON.stringify(bad));
    }
    const big = s.safeParse({ pageSize: "500", page: "0" });
    assert.ok(big.success);
    assert.equal(big.data.pageSize, 100); // clamped to 100
    assert.equal(big.data.page, 1); // clamped to 1
    const zero = s.safeParse({ pageSize: "0" });
    assert.ok(zero.success);
    assert.equal(zero.data.pageSize, 1);
  });
  await check("audit query: action prefix and date range", () => {
    const s = dev.auditQuerySchema;
    const ok = s.safeParse({ action: "impersonation.", from: "2026-09-01", to: "2026-09-30", actor: "123e4567-e89b-42d3-a456-426614174000" });
    assert.ok(ok.success);
    assert.equal(ok.data.from, "2026-09-01T00:00:00.000Z");
    assert.equal(ok.data.to, "2026-09-30T23:59:59.999Z");
    for (const bad of [{ action: "imp%" }, { action: "a b" }, { action: "a;b" }, { action: "x".repeat(65) }, { from: "garbage" }, { to: "2026-02-31" }, { actor: "nope" }, { target: "nope" }]) {
      assert.equal(s.safeParse(bad).success, false, JSON.stringify(bad));
    }
  });
  await check("parseDevQuery: empty values are dropped, garbage is a 400", () => {
    const parsed = dev.parseDevQuery(dev.schoolsQuerySchema, "http://x.test/api/dev/schools?q=&page=2&unknown=1");
    assert.deepEqual(parsed, { page: 2 });
    assert.throws(
      () => dev.parseDevQuery(dev.usersQuerySchema, "http://x.test/api/dev/users?role=root"),
      (err: unknown) => err instanceof ApiError && err.status === 400,
    );
  });
  await check("start body: strict, uuid target, bounded reason", () => {
    const s = dev.startBodySchema;
    const id = "123e4567-e89b-42d3-a456-426614174000";
    assert.ok(s.safeParse({ targetUserId: id, reason: "a long enough reason" }).success);
    assert.equal(s.safeParse({ targetUserId: id, reason: "ok", extra: 1 }).success, false);
    assert.equal(s.safeParse({ targetUserId: "abc", reason: "a long enough reason" }).success, false);
    assert.equal(s.safeParse({ targetUserId: id }).success, false);
    assert.equal(s.safeParse({ targetUserId: id, reason: "x".repeat(2001) }).success, false);
  });

  // ---------------------------------------------------------------------------
  section("6 architecture: Prisma/PostgreSQL only, in repositories only");
  const root = process.cwd(); // the script is run from the project root (see the command at the top)
  const laneFiles = new Set<string>([
    "lib/api/guard.ts",
    "lib/api/impersonation.ts",
    "lib/api/impersonation.check.ts",
    "lib/dev-server.ts",
    "lib/dev-types.ts",
    "lib/repositories/impersonation.repo.ts",
    "lib/repositories/dev-console.repo.ts",
    "lib/repositories/me.repo.ts",
    "app/api/auth/me/route.ts",
    "hooks/useMe.ts",
    "components/dev/services.ts",
    "components/dev/HealthGrid.tsx",
  ]);
  (function addTree(dir: string): void {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(root, rel)).isDirectory()) addTree(rel);
      else if (name.endsWith(".ts")) laneFiles.add(rel);
    }
  })("app/api/dev");
  // Comments are dropped first: they may legitimately mention the old names (for example "was Supabase").
  const source = (rel: string) =>
    readFileSync(join(root, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

  // Pieces are joined so this file never contains the forbidden word as an import itself.
  const SUPA = ["supa", "base"].join("");
  const supabaseUse = new RegExp(
    [
      `from\\s+["'][^"']*${SUPA}`, // import ... from "...supabase..."
      `import\\(\\s*["'][^"']*${SUPA}`, // dynamic import
      `require\\(\\s*["'][^"']*${SUPA}`,
      `@${SUPA}/`,
      `create${SUPA[0].toUpperCase()}${SUPA.slice(1)}Client`, // the old client factory
    ].join("|"),
    "i",
  );
  const prismaImport = /from\s+["'][^"']*(lib\/db\/prisma|generated\/prisma)/;

  await check("lane files were found", () => {
    assert.ok(laneFiles.size >= 18, `only ${laneFiles.size} lane files found; is the script running from the project root?`);
    for (const rel of ["lib/dev-server.ts", "lib/repositories/impersonation.repo.ts", "app/api/dev/overview/route.ts"]) {
      assert.ok(laneFiles.has(rel), `${rel} missing from the scan`);
    }
  });
  await check("no file of this lane imports Supabase", () => {
    const offenders = Array.from(laneFiles).filter((rel) => supabaseUse.test(source(rel)));
    assert.deepEqual(offenders, []);
  });
  await check("only repositories import the Prisma client", () => {
    const offenders = Array.from(laneFiles).filter(
      (rel) => !rel.startsWith("lib/repositories/") && prismaImport.test(source(rel)),
    );
    assert.deepEqual(offenders.map((rel) => relative(".", rel)), []);
  });
  await check("no PostgREST leftovers and no DATA_BACKEND switch in the dev console or /me", () => {
    for (const rel of ["lib/dev-server.ts", "lib/api/impersonation.ts", "app/api/auth/me/route.ts"]) {
      const text = source(rel);
      assert.ok(!/DATA_BACKEND/.test(text), `${rel} still reads DATA_BACKEND`);
      assert.ok(!/PGRST\d+|\.maybeSingle\(|\.ilike\(/.test(text), `${rel} still has PostgREST code`);
    }
  });
  await check("the repositories never select credential columns", () => {
    for (const rel of ["lib/repositories/impersonation.repo.ts", "lib/repositories/dev-console.repo.ts", "lib/repositories/me.repo.ts"]) {
      assert.ok(!/password_hash|refresh_token_hash|otp_code|code_hash/.test(source(rel)), `${rel} mentions a credential column`);
    }
  });

  // ---------------------------------------------------------------------------
  console.warn = realWarn;
  console.error = realError;

  let total = 0;
  let failedCount = 0;
  for (const [name, s] of sections) {
    total += s.total;
    failedCount += s.failed.length;
    if (s.failed.length === 0) {
      console.log(`PASS  ${name} (${s.total} checks)`);
    } else {
      console.log(`FAIL  ${name}`);
      for (const f of s.failed) console.log(`      - ${f}`);
    }
  }
  console.log(failedCount === 0 ? `\nPASS: all ${total} checks passed` : `\nFAIL: ${failedCount} of ${total} checks failed`);
  process.exit(failedCount === 0 ? 0 : 1);
}

main().catch((err) => {
  console.warn = realWarn;
  console.error = realError;
  console.error("FAIL: check script crashed:", err);
  process.exit(1);
});
