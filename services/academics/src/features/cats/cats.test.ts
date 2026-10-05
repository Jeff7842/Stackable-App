import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOSES, OPENS, answerCorrectly, createScheduled, start } from "../../cat-fixtures";
import { SCHOOL_A, SCHOOL_B, STUDENT, STUDENT_2, adminToken, harness, seedGrading, studentToken, teacherToken, useTestEnv, type Harness } from "../../test-support";
import { autoSubmitDue } from "./deadline-worker";
import { autoMark, responseProblem } from "./marking";

let h: Harness;
beforeEach(() => {
  useTestEnv();
  h = harness("2026-03-01T10:00:00.000Z");
});
afterEach(() => vi.restoreAllMocks());

const attemptOf = (id: string) => h.store.tx(SCHOOL_A, (db) => db.attempts.get(id));

describe("starting an attempt", () => {
  it("computes the deadline from the server clock and hides every key", async () => {
    const id = await createScheduled(h, true);
    const res = await start(h, id, STUDENT);
    expect(res.status).toBe(200);
    expect(res.body.attempt.startedAt).toBe("2026-03-01T10:00:00.000Z");
    expect(res.body.attempt.dueAt).toBe("2026-03-01T10:30:00.000Z");
    expect(res.body.serverNow).toBe("2026-03-01T10:00:00.000Z");
    expect(res.body.questions).toHaveLength(4);
    const text = JSON.stringify(res.body);
    for (const leak of ["answerKey", "isCorrect", "expectedValue", "tolerance", "SECRET-MODEL"]) expect(text).not.toContain(leak);
  });

  it("adds accommodation minutes to the deadline of that student only", async () => {
    const id = await createScheduled(h);
    const set = await h.call("POST", `/v1/assessments/${id}/accommodations`, teacherToken(), { studentId: STUDENT, extraMinutes: 15 });
    expect(set.status).toBe(201);
    expect((await start(h, id, STUDENT)).body.attempt.dueAt).toBe("2026-03-01T10:45:00.000Z");
    expect((await start(h, id, STUDENT_2)).body.attempt.dueAt).toBe("2026-03-01T10:30:00.000Z");
  });

  it("refuses before the window opens", async () => {
    const id = await createScheduled(h);
    h.setNow("2026-03-01T08:59:59.000Z");
    const res = await start(h, id, STUDENT);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "ASSESSMENT_NOT_OPEN" });
  });

  it("refuses at and after the window close", async () => {
    const id = await createScheduled(h);
    h.setNow(CLOSES);
    expect((await start(h, id, STUDENT)).body).toMatchObject({ code: "ASSESSMENT_CLOSED" });
  });

  it("accepts the first second of the window", async () => {
    const id = await createScheduled(h);
    h.setNow(OPENS);
    expect((await start(h, id, STUDENT)).status).toBe(200);
  });

  it("refuses a student from another class", async () => {
    const id = await createScheduled(h);
    expect((await start(h, id, STUDENT, "class-9z")).status).toBe(404);
  });

  it("resuming keeps the original deadline", async () => {
    const id = await createScheduled(h);
    const first = await start(h, id, STUDENT);
    h.setNow("2026-03-01T10:10:00.000Z");
    const again = await start(h, id, STUDENT);
    expect(again.body.attempt.id).toBe(first.body.attempt.id);
    expect(again.body.attempt.dueAt).toBe(first.body.attempt.dueAt);
  });

  it("a draft is not startable", async () => {
    const created = await h.call("POST", "/v1/assessments", teacherToken(), {
      title: "Draft", type: "quiz", classId: "class-7a", durationMinutes: 10, opensAt: OPENS, closesAt: CLOSES,
      questions: [{ type: "short_answer", stem: "q", marks: 1 }],
    });
    expect((await start(h, created.body.id, STUDENT)).status).toBe(404);
  });

  it("rejects exam as an assessment type", async () => {
    const res = await h.call("POST", "/v1/assessments", teacherToken(), {
      title: "E", type: "exam", classId: "c", durationMinutes: 10, opensAt: OPENS, closesAt: CLOSES, questions: [{ type: "short_answer", stem: "q", marks: 1 }],
    });
    expect(res.status).toBe(400);
  });
});

describe("autosave and submit", () => {
  it("autosaves inside the deadline and refuses after it", async () => {
    const id = await createScheduled(h);
    const { body } = await start(h, id, STUDENT);
    const q = body.questions[0];
    const choice = q.choices[0].id;
    expect((await h.call("PUT", `/v1/attempts/${body.attempt.id}/answers/${q.id}`, studentToken(), { response: choice })).status).toBe(200);
    h.setNow("2026-03-01T10:30:00.001Z");
    const late = await h.call("PUT", `/v1/attempts/${body.attempt.id}/answers/${q.id}`, studentToken(), { response: choice });
    expect(late.status).toBe(409);
    expect(late.body).toMatchObject({ code: "ATTEMPT_DEADLINE_PASSED" });
  });

  it("rejects a response of the wrong shape", async () => {
    const id = await createScheduled(h);
    const { body } = await start(h, id, STUDENT);
    const mc = body.questions.find((q: any) => q.type === "multiple_choice");
    const res = await h.call("PUT", `/v1/attempts/${body.attempt.id}/answers/${mc.id}`, studentToken(), { response: "not-a-choice" });
    expect(res.status).toBe(400);
  });

  it("submitting after the deadline is recorded as auto-submitted at the deadline", async () => {
    const id = await createScheduled(h);
    const { body } = await start(h, id, STUDENT);
    h.setNow("2026-03-01T10:45:00.000Z");
    const res = await h.call("POST", `/v1/attempts/${body.attempt.id}/submit`, studentToken());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "AUTO_SUBMITTED", submittedAt: "2026-03-01T10:30:00.000Z" });
  });

  it("without a grading system a fully auto-marked paper waits as SUBMITTED, then is marked by finalise", async () => {
    const id = await createScheduled(h);
    const { body } = await start(h, id, STUDENT);
    await answerCorrectly(h, id, body.attempt.id, STUDENT);
    expect((await h.call("POST", `/v1/attempts/${body.attempt.id}/submit`, studentToken())).body.status).toBe("SUBMITTED");
    const blocked = await h.call("POST", `/v1/attempts/${body.attempt.id}/mark`, teacherToken(), { marks: [], finalise: true });
    expect(blocked.body).toMatchObject({ code: "GRADING_NOT_CONFIGURED" });
  });

  it("another student cannot submit someone else's attempt", async () => {
    const id = await createScheduled(h);
    const { body } = await start(h, id, STUDENT);
    expect((await h.call("POST", `/v1/attempts/${body.attempt.id}/submit`, studentToken(STUDENT_2))).status).toBe(404);
  });
});

describe("deadline worker", () => {
  it("auto-submits only expired attempts and keeps their saved answers", async () => {
    await seedGrading(h);
    const id = await createScheduled(h);
    const a = await start(h, id, STUDENT);
    await answerCorrectly(h, id, a.body.attempt.id, STUDENT);
    h.setNow("2026-03-01T10:20:00.000Z");
    const b = await start(h, id, STUDENT_2); // due 10:50

    expect(await autoSubmitDue(h.store, new Date("2026-03-01T10:29:59.000Z"))).toBe(0);
    expect(await autoSubmitDue(h.store, new Date("2026-03-01T10:31:00.000Z"))).toBe(1);

    const first = await attemptOf(a.body.attempt.id);
    expect(first).toMatchObject({ status: "MARKED", score: 10, submittedAt: "2026-03-01T10:30:00.000Z" });
    expect((await attemptOf(b.body.attempt.id))!.status).toBe("IN_PROGRESS");
    expect(await autoSubmitDue(h.store, new Date("2026-03-01T10:31:00.000Z"))).toBe(0); // idempotent
  });

  it("leaves a short-answer paper AUTO_SUBMITTED for the teacher", async () => {
    await seedGrading(h);
    const id = await createScheduled(h, true);
    const a = await start(h, id, STUDENT);
    await answerCorrectly(h, id, a.body.attempt.id, STUDENT);
    await autoSubmitDue(h.store, new Date("2026-03-01T11:00:00.000Z"));
    expect((await attemptOf(a.body.attempt.id))!.status).toBe("AUTO_SUBMITTED");
  });
});

describe("marking", () => {
  it("auto-marks choice, reorder and calculation, then grades on submit", async () => {
    await seedGrading(h);
    const id = await createScheduled(h);
    const a = await start(h, id, STUDENT);
    await answerCorrectly(h, id, a.body.attempt.id, STUDENT);
    expect((await h.call("POST", `/v1/attempts/${a.body.attempt.id}/submit`, studentToken())).body).toMatchObject({ status: "MARKED", score: 10 });
    const results = await h.store.tx(SCHOOL_A, (db) => db.results.find({ assessmentId: id }));
    expect(results[0]).toMatchObject({ raw: 10, total: 10, pct: 100, grade: "A", points: 12, isPass: true, releasedAt: null });
  });

  it("a teacher marks short answers, finalise needs every answered one marked", async () => {
    await seedGrading(h);
    const id = await createScheduled(h, true);
    const a = await start(h, id, STUDENT);
    await answerCorrectly(h, id, a.body.attempt.id, STUDENT);
    await h.call("POST", `/v1/attempts/${a.body.attempt.id}/submit`, studentToken());
    const short = a.body.questions.find((q: any) => q.type === "short_answer");

    const early = await h.call("POST", `/v1/attempts/${a.body.attempt.id}/mark`, teacherToken(), { marks: [], finalise: true });
    expect(early.body).toMatchObject({ code: "ATTEMPT_UNMARKED_ANSWERS" });
    const tooMany = await h.call("POST", `/v1/attempts/${a.body.attempt.id}/mark`, teacherToken(), { marks: [{ questionId: short.id, marks: 11 }], finalise: false });
    expect(tooMany.status).toBe(400);
    const partial = await h.call("POST", `/v1/attempts/${a.body.attempt.id}/mark`, teacherToken(), { marks: [{ questionId: short.id, marks: 2 }], finalise: false });
    expect(partial.body.status).toBe("UNDER_MARKING");
    const done = await h.call("POST", `/v1/attempts/${a.body.attempt.id}/mark`, teacherToken(), { marks: [{ questionId: short.id, marks: 4 }], finalise: true });
    expect(done.body).toMatchObject({ status: "MARKED", score: 14 });
    const [result] = await h.store.tx(SCHOOL_A, (db) => db.results.find({ assessmentId: id }));
    expect(result).toMatchObject({ raw: 14, total: 20, pct: 70, grade: "B" });
  });

  it("only a teacher can mark", async () => {
    const id = await createScheduled(h);
    const a = await start(h, id, STUDENT);
    expect((await h.call("POST", `/v1/attempts/${a.body.attempt.id}/mark`, studentToken(), { marks: [], finalise: false })).status).toBe(403);
  });

  it("hands back a placeholder scan key and records it", async () => {
    const id = await createScheduled(h);
    const a = await start(h, id, STUDENT);
    const res = await h.call("POST", `/v1/attempts/${a.body.attempt.id}/scan-upload-link`, teacherToken());
    expect(res.status).toBe(201);
    expect(res.body.objectKey).toMatch(new RegExp(`^scans/${SCHOOL_A}/${a.body.attempt.id}/`));
    expect(res.body.uploadUrl).toBeNull();
    expect(await h.store.tx(SCHOOL_A, (db) => db.paperScans.find({}))).toHaveLength(1);
  });
});

describe("pure marking", () => {
  const base = { marks: 4 };
  it("calculation honours the tolerance edges", () => {
    const spec = { expectedValue: 10, tolerance: 0.5 };
    const q = { ...base, type: "calculation" as const, answerKey: null };
    expect(autoMark(q, spec, "10.5")).toBe(4);
    expect(autoMark(q, spec, 9.5)).toBe(4);
    expect(autoMark(q, spec, "10.51")).toBe(0);
    expect(autoMark(q, spec, "abc")).toBe(0);
    expect(autoMark(q, spec, "")).toBe(0);
  });

  it("reorder is all or nothing", () => {
    const q = { ...base, type: "reorder" as const, answerKey: ["a", "b", "c"] };
    expect(autoMark(q, undefined, ["a", "b", "c"])).toBe(4);
    expect(autoMark(q, undefined, ["a", "c", "b"])).toBe(0);
    expect(autoMark(q, undefined, ["a", "b"])).toBe(0);
  });

  it("short answers need a teacher", () => {
    expect(autoMark({ ...base, type: "short_answer", answerKey: null }, undefined, "x")).toBeNull();
  });

  it("checks response shapes", () => {
    const reorder = { type: "reorder" as const, choices: [{ id: "a", label: "A" }, { id: "b", label: "B" }] };
    expect(responseProblem(reorder, ["a", "b"])).toBeUndefined();
    expect(responseProblem(reorder, ["a", "a"])).toBeDefined();
    expect(responseProblem({ type: "calculation", choices: null }, "3.2")).toBeUndefined();
    expect(responseProblem({ type: "calculation", choices: null }, " ")).toBeDefined();
  });
});

describe("tenant isolation", () => {
  it("school B cannot start, list or mark school A assessments", async () => {
    const id = await createScheduled(h);
    const a = await start(h, id, STUDENT);
    expect((await h.call("POST", `/v1/assessments/${id}/attempts`, studentToken(STUDENT, SCHOOL_B), { classId: "class-7a" })).status).toBe(404);
    expect((await h.call("GET", "/v1/assessments", adminToken(SCHOOL_B))).body.items).toEqual([]);
    expect((await h.call("POST", `/v1/attempts/${a.body.attempt.id}/mark`, adminToken(SCHOOL_B), { marks: [], finalise: false })).status).toBe(404);
    expect((await h.call("POST", `/v1/assessments/${id}/schedule`, adminToken(SCHOOL_B))).status).toBe(404);
  });
});
