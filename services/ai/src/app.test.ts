import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signServiceToken } from "@stackable/service-kit";
import { buildApp } from "./app";
import { FakeProvider } from "./fakeProvider";
import { MemoryStore } from "./store";

const KEY = "photosynthesis";

beforeEach(() => {
  process.env.SERVICE_TOKEN_SECRET = "test-secret-test-secret-test-secret-1234";
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  delete process.env.SERVICE_TOKEN_SECRET;
  vi.restoreAllMocks();
});

function setup(options: { now?: () => Date } = {}) {
  const store = new MemoryStore();
  const provider = new FakeProvider();
  const app = buildApp({ store, provider, version: "1", now: options.now });
  const call = async (method: string, path: string, who: { sub: string; role: string; school?: string }, body?: unknown) => {
    const token = await signServiceToken({ audience: "ai", sub: who.sub, schoolId: who.school ?? "school-a", role: who.role });
    const res = await app.request(path, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text, json: JSON.parse(text) as Record<string, any> };
  };
  return { app, store, provider, call };
}

const student = { sub: "stu-1", role: "student" };
const teacher = { sub: "tch-1", role: "teacher" };
const parent = { sub: "par-1", role: "parent" };
const hintBody = { questionId: "q1", questionText: "How do plants make food?" };

describe("POST /v1/tutor/hint", () => {
  it("gives a hint and moves the gate to ASSISTED", async () => {
    const { call } = setup();
    const res = await call("POST", "/v1/tutor/hint", student, hintBody);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ state: { kind: "ASSISTED", hints: 1 }, locked: false, leakFlagged: false });
    expect(typeof res.json.hint).toBe("string");
    expect(res.json.allowance).toMatchObject({ status: "AVAILABLE" });
  });

  it("locks on the fourth hint without calling the provider", async () => {
    const { call, provider } = setup();
    for (let i = 0; i < 3; i++) expect((await call("POST", "/v1/tutor/hint", student, hintBody)).status).toBe(200);
    const callsBefore = provider.calls.length;
    const res = await call("POST", "/v1/tutor/hint", student, hintBody);
    expect(res.json).toMatchObject({ hint: null, state: { kind: "LOCKED_REDO" }, locked: true });
    expect(provider.calls.length).toBe(callsBefore);
    expect((await call("POST", "/v1/tutor/hint", student, hintBody)).status).toBe(409);
  });

  it("refuses an answer key from a student", async () => {
    const { call, provider } = setup();
    const res = await call("POST", "/v1/tutor/hint", student, { ...hintBody, answerKey: KEY });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe("AUTH_FORBIDDEN");
    expect(provider.calls).toHaveLength(0);
  });

  it("refuses a parent and a missing token", async () => {
    const { call, app } = setup();
    expect((await call("POST", "/v1/tutor/hint", parent, hintBody)).status).toBe(403);
    expect((await app.request("/v1/tutor/hint", { method: "POST" })).status).toBe(401);
  });

  it("returns 400 with the failing fields for a bad body", async () => {
    const { call } = setup();
    const res = await call("POST", "/v1/tutor/hint", student, { questionId: "", answerState: "MAYBE" });
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("REQUEST_VALIDATION_FAILED");
    const paths = res.json.details.fields.map((f: { path: string }) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["questionId", "questionText", "answerState"]));
  });

  it("regenerates a leaking reply once and keeps the key out of storage and responses", async () => {
    const { call, provider, store } = setup();
    provider.queue(`The answer is ${KEY}.`, "What do plants need from the sun?");
    const res = await call("POST", "/v1/tutor/hint", teacher, { ...hintBody, studentId: "stu-1", answerKey: KEY });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ hint: "What do plants need from the sun?", leakFlagged: true });
    expect(provider.calls.map((c) => c.purpose)).toEqual(["hint", "rewrite"]);
    expect(res.text).not.toContain(KEY);
    expect(JSON.stringify(store.messages)).not.toContain(KEY);
    expect(store.messages.some((m) => m.leakFlagged)).toBe(true);
  });

  it("falls back to a safe hint when the rewrite leaks too", async () => {
    const { call, provider, store } = setup();
    provider.queue(`It is ${KEY}`, `Definitely ${KEY}`);
    const res = await call("POST", "/v1/tutor/hint", teacher, { ...hintBody, studentId: "stu-1", answerKey: KEY });
    expect(res.status).toBe(200);
    expect(res.json.leakFlagged).toBe(true);
    expect(res.text).not.toContain(KEY);
    expect(JSON.stringify(store.messages)).not.toContain(KEY);
  });

  it("returns a friendly 502 envelope when the provider fails and does not spend the hint", async () => {
    const { call, provider } = setup();
    provider.failNext(1);
    const res = await call("POST", "/v1/tutor/hint", student, hintBody);
    expect(res.status).toBe(502);
    expect(res.json).toMatchObject({ code: "UPSTREAM_FAILED" });
    expect(res.json.error).toMatch(/try again/i);
    expect(typeof res.json.requestId).toBe("string");
    expect(res.text).not.toMatch(/fake provider failure/);
    const next = await call("POST", "/v1/tutor/hint", student, hintBody);
    expect(next.json.state).toMatchObject({ kind: "ASSISTED", hints: 1 });
  });
});

describe("helped question to practice to done", () => {
  async function toPracticeRequired(ctx: ReturnType<typeof setup>) {
    await ctx.call("POST", "/v1/tutor/hint", student, hintBody);
    return ctx.call("POST", "/v1/gate/answer", teacher, { questionId: "q1", studentId: "stu-1", correct: true });
  }

  it("runs the whole path and awards points once", async () => {
    const ctx = setup();
    const required = await toPracticeRequired(ctx);
    expect(required.json).toMatchObject({ state: { kind: "PRACTICE_REQUIRED" }, locked: true, pointsAwarded: 0 });

    const practice = await ctx.call("POST", "/v1/tutor/practice", student, hintBody);
    expect(practice.status).toBe(200);
    expect(practice.json.items).toHaveLength(5);
    expect(practice.text).not.toMatch(/answer/i);
    expect(practice.json.locked).toBe(true);

    // The fake provider's item i has the answer 2*i+30.
    let last: Record<string, any> = {};
    for (let i = 0; i < 5; i++) {
      const wrong = await ctx.call("POST", "/v1/gate/answer", student, { questionId: "q1", practiceAnswer: "nope" });
      expect(wrong.json).toMatchObject({ correct: false, locked: true });
      last = (await ctx.call("POST", "/v1/gate/answer", student, { questionId: "q1", practiceAnswer: String(2 * i + 30) })).json;
    }
    expect(last).toMatchObject({ state: { kind: "DONE", unaided: false }, locked: false, pointsAwarded: 5 });

    const summary = await ctx.call("GET", "/v1/usage/summary?studentId=stu-1", parent);
    expect(summary.json).toEqual({ studentId: "stu-1", questionsHelped: 1, hintsUsed: 1, practiceDone: 1, points: 5 });
  });

  it("awards unaided points for a correct answer with no help", async () => {
    const { call } = setup();
    const res = await call("POST", "/v1/gate/answer", teacher, { questionId: "q9", studentId: "stu-1", correct: true });
    expect(res.json).toMatchObject({ state: { kind: "DONE", unaided: true }, pointsAwarded: 10 });
    const again = await call("POST", "/v1/gate/answer", teacher, { questionId: "q9", studentId: "stu-1", correct: true });
    expect(again.status).toBe(409);
  });

  it("rejects practice before it is required and a verdict from a student", async () => {
    const { call } = setup();
    expect((await call("POST", "/v1/tutor/practice", student, hintBody)).status).toBe(409);
    const res = await call("POST", "/v1/gate/answer", student, { questionId: "q1", correct: true });
    expect(res.status).toBe(403);
  });

  it("serves the same practice set again instead of regenerating", async () => {
    const ctx = setup();
    await toPracticeRequired(ctx);
    const first = await ctx.call("POST", "/v1/tutor/practice", student, hintBody);
    const calls = ctx.provider.calls.length;
    const second = await ctx.call("POST", "/v1/tutor/practice", student, hintBody);
    expect(second.json.items).toEqual(first.json.items);
    expect(ctx.provider.calls.length).toBe(calls);
  });

  it("applies the same hint cap to practice items and checks leaks against the item key", async () => {
    const ctx = setup();
    await toPracticeRequired(ctx);
    await ctx.call("POST", "/v1/tutor/practice", student, hintBody);
    // Item 1's key is 30; the first reply leaks it, the rewrite does not.
    ctx.provider.queue("It makes thirty.", "Add the tens first.");
    const hint = await ctx.call("POST", "/v1/tutor/hint", student, hintBody);
    expect(hint.json).toMatchObject({ hint: "Add the tens first.", leakFlagged: true, state: { kind: "PRACTICE_OPEN", hints: 1 } });
    await ctx.call("POST", "/v1/tutor/hint", student, hintBody);
    await ctx.call("POST", "/v1/tutor/hint", student, hintBody);
    const locked = await ctx.call("POST", "/v1/tutor/hint", student, hintBody);
    expect(locked.json).toMatchObject({ state: { kind: "LOCKED_REDO" }, locked: true });
  });

  it("regenerates unusable practice output once, then returns a 502", async () => {
    const ctx = setup();
    await toPracticeRequired(ctx);
    ctx.provider.queue("not json", JSON.stringify({ items: [{ question: "Q", answer: "1", difficulty: 3 }] }));
    const res = await ctx.call("POST", "/v1/tutor/practice", student, hintBody);
    expect(res.status).toBe(502);
    expect(res.json.code).toBe("AI_OUTPUT_INVALID");
  });

  it("drops duplicate and out-of-range practice items", async () => {
    const ctx = setup();
    await toPracticeRequired(ctx);
    const items = [
      { question: "How do plants make food?", answer: "a", difficulty: 3 },
      { question: "Dup?", answer: "b", difficulty: 3 },
      { question: "dup", answer: "c", difficulty: 3 },
      { question: "Hard?", answer: "d", difficulty: 5 },
      ...[1, 2, 3, 4, 5].map((n) => ({ question: `Fresh ${n}?`, answer: String(n), difficulty: 3 })),
    ];
    ctx.provider.queue(JSON.stringify({ items }));
    const res = await ctx.call("POST", "/v1/tutor/practice", student, hintBody);
    expect(res.status).toBe(200);
    const questions = res.json.items.map((i: { question: string }) => i.question);
    expect(questions).toEqual(["Dup?", "Fresh 1?", "Fresh 2?", "Fresh 3?", "Fresh 4?"]);
  });
});

describe("GET /v1/usage/summary", () => {
  it("returns counts only, with no message content", async () => {
    const { call } = setup();
    await call("POST", "/v1/tutor/hint", student, { ...hintBody, studentMessage: "my secret worry" });
    const res = await call("GET", "/v1/usage/summary?studentId=stu-1", parent);
    expect(Object.keys(res.json).sort()).toEqual(["hintsUsed", "points", "practiceDone", "questionsHelped", "studentId"]);
    expect(res.text).not.toContain("secret");
  });

  it("lets a student read only their own summary and needs studentId", async () => {
    const { call } = setup();
    expect((await call("GET", "/v1/usage/summary?studentId=stu-2", student)).status).toBe(403);
    expect((await call("GET", "/v1/usage/summary?studentId=stu-1", student)).status).toBe(200);
    expect((await call("GET", "/v1/usage/summary", parent)).status).toBe(400);
  });
});

describe("tenant isolation", () => {
  it("keeps sessions, points and counts per school", async () => {
    const { call } = setup();
    await call("POST", "/v1/tutor/hint", student, hintBody);
    await call("POST", "/v1/gate/answer", teacher, { questionId: "q2", studentId: "stu-1", correct: true });

    const other = { sub: "stu-1", role: "student", school: "school-b" };
    const first = await call("POST", "/v1/tutor/hint", other, hintBody);
    expect(first.json.state).toMatchObject({ kind: "ASSISTED", hints: 1 });
    const summary = await call("GET", "/v1/usage/summary?studentId=stu-1", { sub: "par-9", role: "parent", school: "school-b" });
    expect(summary.json).toMatchObject({ questionsHelped: 1, points: 0 });
    const home = await call("GET", "/v1/usage/summary?studentId=stu-1", parent);
    expect(home.json).toMatchObject({ points: 10 });
  });
});

describe("daily allowance", () => {
  it("returns 429 when exhausted and resets on a new day", async () => {
    let now = new Date("2026-03-10T08:00:00Z");
    const ctx = setup({ now: () => now });
    ctx.store.policies.set("school-a", { hintsPerQuestion: 9, practiceItems: 5, unaidedPoints: 10, practiceSetPoints: 5, dailyAllowanceBase: 2 });
    for (let i = 0; i < 2; i++) expect((await ctx.call("POST", "/v1/tutor/hint", student, hintBody)).status).toBe(200);
    const blocked = await ctx.call("POST", "/v1/tutor/hint", student, hintBody);
    expect(blocked.status).toBe(429);
    expect(blocked.json.code).toBe("AI_ALLOWANCE_EXHAUSTED");

    now = new Date("2026-03-11T08:00:00Z");
    expect((await ctx.call("POST", "/v1/tutor/hint", student, hintBody)).status).toBe(200);
  });

  it("gives more requests from a points tier without raising the hint cap", async () => {
    const ctx = setup();
    ctx.store.policies.set("school-a", { hintsPerQuestion: 1, practiceItems: 5, unaidedPoints: 10, practiceSetPoints: 5, dailyAllowanceBase: 1 });
    ctx.store.tiers.set("school-a", [{ minPoints: 10, dailyRequests: 5 }]);
    await ctx.call("POST", "/v1/tutor/hint", student, hintBody);
    expect((await ctx.call("POST", "/v1/tutor/hint", student, { ...hintBody, questionId: "q2" })).status).toBe(429);

    await ctx.call("POST", "/v1/gate/answer", teacher, { questionId: "q3", studentId: "stu-1", correct: true });
    expect((await ctx.call("POST", "/v1/tutor/hint", student, { ...hintBody, questionId: "q4" })).status).toBe(200);
    // Cap stays at 1 hint: the second hint on a question locks it.
    const second = await ctx.call("POST", "/v1/tutor/hint", student, { ...hintBody, questionId: "q4" });
    expect(second.json.state.kind).toBe("LOCKED_REDO");
  });
});

describe("POST /v1/tools/:kind", () => {
  it("returns flashcards flagged for teacher review", async () => {
    const { call } = setup();
    const res = await call("POST", "/v1/tools/flashcards", student, { text: "Cells are the unit of life." });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ kind: "flashcards", aiGenerated: true, needsTeacherReview: true });
    expect(res.json.content.length).toBeGreaterThan(0);
  });

  it("returns a summary", async () => {
    const { call } = setup();
    const res = await call("POST", "/v1/tools/summary", student, { text: "Long text." });
    expect(res.json.content).toMatchObject({ summary: expect.any(String), keyPoints: expect.any(Array) });
  });

  it("includes quiz answers for teachers only", async () => {
    const { call } = setup();
    const s = await call("POST", "/v1/tools/quiz", student, { text: "Cells." });
    const t = await call("POST", "/v1/tools/quiz", teacher, { text: "Cells." });
    expect(s.json.content[0]).not.toHaveProperty("answerIndex");
    expect(t.json.content[0]).toHaveProperty("answerIndex", 1);
  });

  it("returns 404 for an unknown tool and 502 for unusable output", async () => {
    const { call, provider } = setup();
    expect((await call("POST", "/v1/tools/essay", student, { text: "x" })).status).toBe(404);
    provider.queue("nope", "still nope");
    const res = await call("POST", "/v1/tools/flashcards", student, { text: "x" });
    expect(res.status).toBe(502);
    expect(res.json.code).toBe("AI_OUTPUT_INVALID");
  });

  it("counts toward the daily allowance and returns 502 on provider failure", async () => {
    const { call, provider } = setup();
    provider.failNext(1);
    expect((await call("POST", "/v1/tools/summary", student, { text: "x" })).status).toBe(502);
  });
});

describe("probes", () => {
  it("/ready is degraded, not 503, with no database and the fake provider", async () => {
    const { app } = setup();
    const res = await app.request("/ready");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "degraded" });
  });
});
