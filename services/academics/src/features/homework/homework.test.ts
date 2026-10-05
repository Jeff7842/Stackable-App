import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLASS_ID, PARENT, SCHOOL_A, SCHOOL_B, STUDENT, STUDENT_2, SUBJECT_ID, adminToken, harness, parentToken, studentToken, teacherToken, token, useTestEnv,
  type Harness,
} from "../../test-support";

const SECRET_KEY = "SECRET-MODEL-ANSWER-42";
const DUE = "2026-03-05T12:00:00Z";
const CLOSES = "2026-03-06T12:00:00Z";

let h: Harness;
beforeEach(() => {
  useTestEnv();
  h = harness("2026-03-02T08:00:00.000Z");
});
afterEach(() => vi.restoreAllMocks());

async function seedPublished() {
  const created = await h.call("POST", "/v1/homework/assignments", teacherToken(), {
    title: "Fractions",
    classId: CLASS_ID,
    subjectId: SUBJECT_ID,
    dueAt: DUE,
    closesAt: CLOSES,
    items: [
      { marks: 2, question: { type: "multiple_choice", stem: "1/2 + 1/2?", options: [{ label: "1", isCorrect: true }, { label: "2", isCorrect: false }] } },
      { marks: 5, question: { type: "short_answer", stem: "Explain a fraction", answerKey: SECRET_KEY } },
    ],
  });
  expect(created.status).toBe(201);
  const id = created.body.id as string;
  expect((await h.call("POST", `/v1/homework/assignments/${id}/publish`, teacherToken())).status).toBe(200);
  const view = await h.call("GET", `/v1/homework/assignments/${id}`, teacherToken());
  return { id, items: view.body.items as any[] };
}

async function startAndAnswer(assignmentId: string, items: any[], student = STUDENT) {
  const opened = await h.call("POST", `/v1/homework/assignments/${assignmentId}/open`, studentToken(student), { classId: CLASS_ID });
  const submissionId = opened.body.submission.id as string;
  const correct = items[0].question.options.find((o: any) => o.isCorrect);
  await h.call("PUT", `/v1/homework/submissions/${submissionId}/answers/${items[0].id}`, studentToken(student), { selectedOptionId: correct.id });
  const saved = await h.call("PUT", `/v1/homework/submissions/${submissionId}/answers/${items[1].id}`, studentToken(student), { responseText: "MY-ANSWER-TEXT" });
  return { submissionId, shortAnswerId: saved.body.id as string };
}

describe("assignments", () => {
  it("publishing writes the assignment.published outbox row", async () => {
    await seedPublished();
    const rows = await h.store.tx(SCHOOL_A, (db) => db.outbox.find({ topic: "assignment.published" }));
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toMatchObject({ title: "Fractions", classId: CLASS_ID });
    expect(rows[0].publishedAt).toBeNull();
  });

  it("refuses a student creating an assignment", async () => {
    const res = await h.call("POST", "/v1/homework/assignments", studentToken(), {});
    expect(res.status).toBe(403);
  });

  it("returns the standard envelope for invalid input", async () => {
    const res = await h.call("POST", "/v1/homework/assignments", teacherToken(), { title: "" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "REQUEST_VALIDATION_FAILED" });
    expect(res.body.details.fields.length).toBeGreaterThan(0);
    expect(res.body.requestId).toBeTruthy();
  });

  it("rejects a multiple choice question with no correct option", async () => {
    const res = await h.call("POST", "/v1/homework/assignments", teacherToken(), {
      title: "T", classId: CLASS_ID, subjectId: SUBJECT_ID, dueAt: DUE, closesAt: CLOSES,
      items: [{ marks: 1, question: { type: "multiple_choice", stem: "q", options: [{ label: "a", isCorrect: false }, { label: "b", isCorrect: false }] } }],
    });
    expect(res.status).toBe(400);
  });

  it("students never see answer keys or correct flags", async () => {
    const { id } = await seedPublished();
    const view = await h.call("GET", `/v1/homework/assignments/${id}`, studentToken());
    const text = JSON.stringify(view.body);
    expect(text).not.toContain(SECRET_KEY);
    expect(text).not.toContain("answerKey");
    expect(text).not.toContain("isCorrect");
    const list = await h.call("GET", `/v1/homework/assignments?classId=${CLASS_ID}`, studentToken());
    expect(list.body.items).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(SECRET_KEY);
  });

  it("hides drafts from students", async () => {
    const created = await h.call("POST", "/v1/homework/assignments", teacherToken(), {
      title: "Draft", classId: CLASS_ID, subjectId: SUBJECT_ID, dueAt: DUE, closesAt: CLOSES,
      items: [{ marks: 1, question: { type: "research", stem: "r" } }],
    });
    expect((await h.call("GET", `/v1/homework/assignments/${created.body.id}`, studentToken())).status).toBe(404);
  });
});

describe("submissions", () => {
  it("auto-marks multiple choice on submit", async () => {
    const { id, items } = await seedPublished();
    const { submissionId } = await startAndAnswer(id, items);
    const res = await h.call("POST", `/v1/homework/submissions/${submissionId}/submit`, studentToken());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "SUBMITTED", late: false });
    const answers = await h.store.tx(SCHOOL_A, (db) => db.answers.find({ submissionId }));
    expect(answers.find((a) => a.itemId === items[0].id)?.marksAwarded).toBe(2);
  });

  it("flags a late submission but still accepts it", async () => {
    const { id, items } = await seedPublished();
    const { submissionId } = await startAndAnswer(id, items);
    h.setNow("2026-03-06T12:00:01.000Z"); // one second after closesAt
    const res = await h.call("POST", `/v1/homework/submissions/${submissionId}/submit`, studentToken());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "SUBMITTED", late: true });
  });

  it("refuses submit while any answer is gate-locked, and allows it after unlock", async () => {
    const { id, items } = await seedPublished();
    const { submissionId, shortAnswerId } = await startAndAnswer(id, items);
    const aiToken = token("ai-service", "ai");
    expect((await h.call("POST", `/v1/answers/${shortAnswerId}/gate`, aiToken, { locked: true })).status).toBe(200);

    const blocked = await h.call("POST", `/v1/homework/submissions/${submissionId}/submit`, studentToken());
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ code: "HOMEWORK_AI_GATE_LOCKED" });

    await h.call("POST", `/v1/answers/${shortAnswerId}/gate`, aiToken, { locked: false });
    expect((await h.call("POST", `/v1/homework/submissions/${submissionId}/submit`, studentToken())).status).toBe(200);
  });

  it("only the ai service may set the gate", async () => {
    const { id, items } = await seedPublished();
    const { shortAnswerId } = await startAndAnswer(id, items);
    expect((await h.call("POST", `/v1/answers/${shortAnswerId}/gate`, studentToken(), { locked: false })).status).toBe(403);
  });

  it("another student cannot touch the submission", async () => {
    const { id, items } = await seedPublished();
    const { submissionId } = await startAndAnswer(id, items);
    expect((await h.call("POST", `/v1/homework/submissions/${submissionId}/submit`, studentToken(STUDENT_2))).status).toBe(404);
  });

  it("refuses opening for the wrong class", async () => {
    const { id } = await seedPublished();
    const res = await h.call("POST", `/v1/homework/assignments/${id}/open`, studentToken(), { classId: "class-9z" });
    expect(res.status).toBe(404);
  });

  it("refuses a second submit", async () => {
    const { id, items } = await seedPublished();
    const { submissionId } = await startAndAnswer(id, items);
    await h.call("POST", `/v1/homework/submissions/${submissionId}/submit`, studentToken());
    expect((await h.call("POST", `/v1/homework/submissions/${submissionId}/submit`, studentToken())).status).toBe(409);
  });
});

describe("review", () => {
  async function submitted() {
    const { id, items } = await seedPublished();
    const { submissionId } = await startAndAnswer(id, items);
    await h.call("POST", `/v1/homework/submissions/${submissionId}/submit`, studentToken());
    return submissionId;
  }

  it.each(["RETURNED", "REJECTED"])("%s requires a reason", async (decision) => {
    const submissionId = await submitted();
    const none = await h.call("POST", `/v1/homework/submissions/${submissionId}/review`, teacherToken(), { decision });
    expect(none.status).toBe(400);
    const blank = await h.call("POST", `/v1/homework/submissions/${submissionId}/review`, teacherToken(), { decision, reason: "   " });
    expect(blank.status).toBe(400);
    const ok = await h.call("POST", `/v1/homework/submissions/${submissionId}/review`, teacherToken(), { decision, reason: "Show your working" });
    expect(ok.body).toMatchObject({ status: decision });
  });

  it("APPROVED needs no reason", async () => {
    const submissionId = await submitted();
    const res = await h.call("POST", `/v1/homework/submissions/${submissionId}/review`, teacherToken(), { decision: "APPROVED" });
    expect(res.body).toMatchObject({ status: "APPROVED" });
  });

  it("a returned submission goes back to in progress when the student edits it", async () => {
    const { id, items } = await seedPublished();
    const { submissionId } = await startAndAnswer(id, items);
    await h.call("POST", `/v1/homework/submissions/${submissionId}/submit`, studentToken());
    await h.call("POST", `/v1/homework/submissions/${submissionId}/review`, teacherToken(), { decision: "RETURNED", reason: "Redo" });
    await h.call("PUT", `/v1/homework/submissions/${submissionId}/answers/${items[1].id}`, studentToken(), { responseText: "better" });
    expect((await h.call("POST", `/v1/homework/submissions/${submissionId}/submit`, studentToken())).body).toMatchObject({ status: "SUBMITTED" });
  });

  it("a student cannot review", async () => {
    const submissionId = await submitted();
    expect((await h.call("POST", `/v1/homework/submissions/${submissionId}/review`, studentToken(), { decision: "APPROVED" })).status).toBe(403);
  });
});

describe("parent read model", () => {
  it("returns status, dates, teacher comment and supplied AI counts, and never answers or keys", async () => {
    const { id, items } = await seedPublished();
    const { submissionId } = await startAndAnswer(id, items);
    await h.call("POST", `/v1/homework/submissions/${submissionId}/submit`, studentToken());
    await h.call("POST", `/v1/homework/submissions/${submissionId}/review`, teacherToken(), { decision: "RETURNED", reason: "Add a diagram" });

    const res = await h.call("GET", `/v1/parents/${PARENT}/children/${STUDENT}/homework?aiHints=2&aiPractice=1`, parentToken());
    expect(res.status).toBe(200);
    expect(res.body.aiUsage).toEqual({ hints: 2, practice: 1 });
    expect(res.body.items[0]).toMatchObject({ title: "Fractions", status: "RETURNED", teacherComment: "Add a diagram", late: false });

    const text = JSON.stringify(res.body);
    for (const leak of [SECRET_KEY, "MY-ANSWER-TEXT", "answerKey", "answer_key", "responseText", "isCorrect", "transcript"]) {
      expect(text).not.toContain(leak);
    }
  });

  it("a parent can only ask as themselves", async () => {
    const res = await h.call("GET", `/v1/parents/${PARENT}/children/${STUDENT}/homework`, parentToken("parent-2"));
    expect(res.status).toBe(403);
  });

  it("a student cannot use the parent endpoint", async () => {
    expect((await h.call("GET", `/v1/parents/${PARENT}/children/${STUDENT}/homework`, studentToken())).status).toBe(403);
  });

  it("stores a parent acknowledgement", async () => {
    const { id, items } = await seedPublished();
    const { submissionId } = await startAndAnswer(id, items);
    const res = await h.call("POST", `/v1/parents/${PARENT}/children/${STUDENT}/homework/${submissionId}/review`, parentToken(), { acknowledged: true, comment: "Seen" });
    expect(res.body).toMatchObject({ acknowledged: true, comment: "Seen" });
  });
});

describe("tenant isolation", () => {
  it("school B cannot read, list, publish or open school A homework", async () => {
    const { id } = await seedPublished();
    expect((await h.call("GET", `/v1/homework/assignments/${id}`, teacherToken(SCHOOL_B))).status).toBe(404);
    expect((await h.call("GET", `/v1/homework/assignments`, teacherToken(SCHOOL_B))).body.items).toEqual([]);
    expect((await h.call("POST", `/v1/homework/assignments/${id}/publish`, adminToken(SCHOOL_B))).status).toBe(404);
    expect((await h.call("POST", `/v1/homework/assignments/${id}/open`, studentToken(STUDENT, SCHOOL_B), { classId: CLASS_ID })).status).toBe(404);
  });
});

