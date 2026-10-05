import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerCorrectly, createScheduled, start } from "../../cat-fixtures";
import {
  SCHOOL_A, SCHOOL_B, STUDENT, STUDENT_2, adminToken, harness, releaserToken, seedGrading, studentToken, teacherToken, token, useTestEnv, type Harness,
} from "../../test-support";

const AFTER_CLOSE = "2026-03-01T12:30:00.000Z";

beforeEach(() => useTestEnv());
afterEach(() => vi.restoreAllMocks());

/** Two students submit perfect papers; returns the assessment id with every script marked. */
async function markedAssessment(h: Harness): Promise<string> {
  await seedGrading(h);
  const id = await createScheduled(h);
  for (const student of [STUDENT, STUDENT_2]) {
    const a = await start(h, id, student);
    await answerCorrectly(h, id, a.body.attempt.id, student);
    await h.call("POST", `/v1/attempts/${a.body.attempt.id}/submit`, studentToken(student));
  }
  h.setNow(AFTER_CLOSE);
  return id;
}

const results = (h: Harness, assessmentId: string) => h.store.tx(SCHOOL_A, (db) => db.results.find({ assessmentId }));

describe("release", () => {
  it("needs the rel claim: teacher and admin tokens without it can never release", async () => {
    const h = harness("2026-03-01T10:00:00.000Z");
    const id = await markedAssessment(h);
    for (const bearer of [teacherToken(), adminToken(), token("t", "teacher", SCHOOL_A, { rel: false })]) {
      const res = await h.call("POST", `/v1/assessments/${id}/release`, bearer);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: "RESULTS_RELEASE_FORBIDDEN" });
    }
    expect((await results(h, id)).every((r) => r.releasedAt === null)).toBe(true);
  });

  it("a student token with rel still cannot release", async () => {
    const h = harness("2026-03-01T10:00:00.000Z");
    const id = await markedAssessment(h);
    expect((await h.call("POST", `/v1/assessments/${id}/release`, token(STUDENT, "student", SCHOOL_A, { rel: true }))).status).toBe(403);
  });

  it("releases every result at once with one timestamp and writes results.released", async () => {
    const h = harness("2026-03-01T10:00:00.000Z");
    const id = await markedAssessment(h);
    const res = await h.call("POST", `/v1/assessments/${id}/release`, releaserToken());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ count: 2, releasedAt: AFTER_CLOSE });

    expect((await results(h, id)).map((r) => r.releasedAt)).toEqual([AFTER_CLOSE, AFTER_CLOSE]);
    const outbox = await h.store.tx(SCHOOL_A, (db) => db.outbox.find({ topic: "results.released" }));
    expect(outbox).toHaveLength(1);
    expect(outbox[0].payload).toMatchObject({ assessmentId: id, resultCount: 2 });
    const assessment = await h.store.tx(SCHOOL_A, (db) => db.assessments.get(id));
    expect(assessment!.status).toBe("RELEASED");
    expect((await h.call("POST", `/v1/assessments/${id}/release`, releaserToken())).body).toMatchObject({ code: "RESULTS_ALREADY_RELEASED" });
  });

  it("is atomic: a failure after the results update releases nothing", async () => {
    const h = harness("2026-03-01T10:00:00.000Z", {
      onInsert: (table) => {
        if (table === "outbox" && armed) throw new Error("outbox down");
      },
    });
    let armed = false;
    const id = await markedAssessment(h);
    armed = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await h.call("POST", `/v1/assessments/${id}/release`, releaserToken());
    expect(res.status).toBe(500);
    expect((await results(h, id)).every((r) => r.releasedAt === null)).toBe(true);
    const assessment = await h.store.tx(SCHOOL_A, (db) => db.assessments.get(id));
    expect(assessment!.status).not.toBe("RELEASED");
    expect(await h.store.tx(SCHOOL_A, (db) => db.outbox.find({ topic: "results.released" }))).toHaveLength(0);

    armed = false;
    expect((await h.call("POST", `/v1/assessments/${id}/release`, releaserToken())).status).toBe(200);
  });

  it("refuses while any script is unmarked and names how many", async () => {
    const h = harness("2026-03-01T10:00:00.000Z");
    await seedGrading(h);
    const id = await createScheduled(h, true); // has a short answer, so papers wait for the teacher
    for (const student of [STUDENT, STUDENT_2]) {
      const a = await start(h, id, student);
      await answerCorrectly(h, id, a.body.attempt.id, student);
      await h.call("POST", `/v1/attempts/${a.body.attempt.id}/submit`, studentToken(student));
    }
    h.setNow(AFTER_CLOSE);
    const res = await h.call("POST", `/v1/assessments/${id}/release`, releaserToken());
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "RESULTS_UNMARKED_SCRIPTS", details: { count: 2 } });
  });

  it("refuses an attempt still in progress", async () => {
    const h = harness("2026-03-01T10:00:00.000Z");
    await seedGrading(h);
    const id = await createScheduled(h);
    await start(h, id, STUDENT);
    h.setNow(AFTER_CLOSE);
    expect((await h.call("POST", `/v1/assessments/${id}/release`, releaserToken())).body).toMatchObject({ code: "RESULTS_UNMARKED_SCRIPTS" });
  });

  it("refuses while the window is still open", async () => {
    const h = harness("2026-03-01T10:00:00.000Z");
    const id = await markedAssessment(h);
    h.setNow("2026-03-01T11:00:00.000Z");
    expect((await h.call("POST", `/v1/assessments/${id}/release`, releaserToken())).body).toMatchObject({ code: "ASSESSMENT_STILL_OPEN" });
  });

  it("students see their own result only after release", async () => {
    const h = harness("2026-03-01T10:00:00.000Z");
    const id = await markedAssessment(h);
    expect((await h.call("GET", `/v1/assessments/${id}/results`, studentToken())).body.items).toEqual([]);
    await h.call("POST", `/v1/assessments/${id}/release`, releaserToken());
    const mine = await h.call("GET", `/v1/assessments/${id}/results`, studentToken());
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0]).toMatchObject({ studentId: STUDENT, grade: "A" });
    expect((await h.call("GET", `/v1/assessments/${id}/results`, teacherToken())).body.items).toHaveLength(2);
  });

  it("school B cannot release school A results", async () => {
    const h = harness("2026-03-01T10:00:00.000Z");
    const id = await markedAssessment(h);
    expect((await h.call("POST", `/v1/assessments/${id}/release`, releaserToken(SCHOOL_B))).status).toBe(404);
    expect((await results(h, id)).every((r) => r.releasedAt === null)).toBe(true);
  });
});

describe("grading systems", () => {
  it("rejects bands with a gap and reports the rows", async () => {
    const h = harness();
    const res = await h.call("POST", "/v1/grading/systems", adminToken(), {
      name: "Bad", effectiveFrom: "2026-01-01T00:00:00Z",
      bands: [{ minPct: 0, maxPct: 39, grade: "E", points: 1 }, { minPct: 45, maxPct: 100, grade: "A", points: 12 }],
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "GRADING_BANDS_INVALID" });
    expect(res.body.details.issues[0]).toMatchObject({ code: "GAP", rows: [0, 1] });
  });

  it("only an admin manages systems", async () => {
    const h = harness();
    expect((await h.call("POST", "/v1/grading/systems", teacherToken(), {})).status).toBe(403);
  });

  it("activating a new system deactivates the old one, and old results keep their system id", async () => {
    const h = harness("2026-03-01T10:00:00.000Z");
    const id = await markedAssessment(h);
    const before = await results(h, id);

    const created = await h.call("POST", "/v1/grading/systems", adminToken(), {
      name: "Strict", effectiveFrom: "2026-06-01T00:00:00Z",
      bands: [{ minPct: 0, maxPct: 89, grade: "B", points: 5 }, { minPct: 90, maxPct: 100, grade: "A", points: 12 }],
    });
    await h.call("POST", `/v1/grading/systems/${created.body.id}/activate`, adminToken());

    const systems = (await h.call("GET", "/v1/grading/systems", adminToken())).body.items;
    expect(systems.filter((s: any) => s.active).map((s: any) => s.name)).toEqual(["Strict"]);
    expect((await results(h, id)).map((r) => r.systemId)).toEqual(before.map((r) => r.systemId));
    expect(before[0].systemId).not.toBe(created.body.id);
  });

  it("a per-subject pass mark overrides the default", async () => {
    const h = harness("2026-03-01T10:00:00.000Z");
    await seedGrading(h);
    const system = (await h.call("GET", "/v1/grading/systems", adminToken())).body.items[0];
    await h.call("PUT", `/v1/grading/systems/${system.id}/pass-marks`, adminToken(), { subjectId: "subject-math", passPct: 100 });
    const id = await createScheduled(h, true);
    const a = await start(h, id, STUDENT);
    await answerCorrectly(h, id, a.body.attempt.id, STUDENT);
    await h.call("POST", `/v1/attempts/${a.body.attempt.id}/submit`, studentToken());
    const short = a.body.questions.find((q: any) => q.type === "short_answer");
    await h.call("POST", `/v1/attempts/${a.body.attempt.id}/mark`, teacherToken(), { marks: [{ questionId: short.id, marks: 5 }], finalise: true });
    const [result] = await results(h, id);
    expect(result).toMatchObject({ pct: 75, isPass: false }); // 75 is below the subject mark of 100, above the default 40
  });
});
