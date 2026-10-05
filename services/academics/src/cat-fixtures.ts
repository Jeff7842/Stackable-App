import { CLASS_ID, SCHOOL_A, SUBJECT_ID, studentToken, teacherToken, type Harness } from "./test-support";

export const OPENS = "2026-03-01T09:00:00.000Z";
export const CLOSES = "2026-03-01T12:00:00.000Z";
export const DURATION_MINUTES = 30;

const AUTO_QUESTIONS = [
  { type: "multiple_choice", stem: "2+2?", marks: 2, choices: [{ label: "4", isCorrect: true }, { label: "5", isCorrect: false }] },
  { type: "reorder", stem: "Order the planets", marks: 3, items: ["Mercury", "Venus", "Earth"] },
  { type: "calculation", stem: "Area of 3 by 4.1?", marks: 5, expectedValue: 12.3, tolerance: 0.05 },
];
const SHORT_QUESTION = { type: "short_answer", stem: "Define a prime", marks: 10, modelAnswer: "SECRET-MODEL" };

/** Creates and schedules an assessment; withShort adds one teacher-marked question. */
export async function createScheduled(h: Harness, withShort = false): Promise<string> {
  const created = await h.call("POST", "/v1/assessments", teacherToken(), {
    title: "CAT 1", type: "cat", classId: CLASS_ID, subjectId: SUBJECT_ID, durationMinutes: DURATION_MINUTES,
    opensAt: OPENS, closesAt: CLOSES, questions: withShort ? [...AUTO_QUESTIONS, SHORT_QUESTION] : AUTO_QUESTIONS,
  });
  if (created.status !== 201) throw new Error(`create failed: ${JSON.stringify(created.body)}`);
  const scheduled = await h.call("POST", `/v1/assessments/${created.body.id}/schedule`, teacherToken());
  if (scheduled.status !== 200) throw new Error(`schedule failed: ${JSON.stringify(scheduled.body)}`);
  return created.body.id;
}

export const start = (h: Harness, assessmentId: string, student: string, classId = CLASS_ID) =>
  h.call("POST", `/v1/assessments/${assessmentId}/attempts`, studentToken(student), { classId });

/** Saves a correct answer to every auto-markable question, reading the keys straight from the store. */
export async function answerCorrectly(h: Harness, assessmentId: string, attemptId: string, student: string): Promise<void> {
  const questions = await h.store.tx(SCHOOL_A, (db) => db.assessmentQuestions.find({ assessmentId }));
  const specs = await h.store.tx(SCHOOL_A, (db) => db.calcSpecs.find({}));
  for (const q of questions) {
    let response: unknown;
    if (q.type === "multiple_choice") response = q.answerKey;
    else if (q.type === "reorder") response = q.answerKey;
    else if (q.type === "calculation") response = String(specs.find((s) => s.questionId === q.id)!.expectedValue);
    else response = "A number with exactly two divisors";
    const res = await h.call("PUT", `/v1/attempts/${attemptId}/answers/${q.id}`, studentToken(student), { response });
    if (res.status !== 200) throw new Error(`autosave failed: ${JSON.stringify(res.body)}`);
  }
}
