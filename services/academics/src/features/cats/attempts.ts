import { errors } from "@stackable/service-kit";
import { STUDENT_ROLES, TEACHER_ROLES, domainError, isAdmin, requireRole, type Actor } from "../../lib/auth";
import type { Db } from "../../store/tables";
import { getActiveSystem, recordResult } from "../grading/service";
import { autoMark, responseProblem, studentQuestion } from "./marking";
import { questionsOf } from "./assessments";
import type { Assessment, Attempt, AttemptStatus } from "./types";

const MS_PER_MINUTE = 60_000;
const MARKABLE: AttemptStatus[] = ["SUBMITTED", "AUTO_SUBMITTED", "UNDER_MARKING", "MARKED"];

async function ownAttempt(db: Db, actor: Actor, attemptId: string): Promise<Attempt> {
  requireRole(actor, STUDENT_ROLES);
  const attempt = await db.attempts.get(attemptId);
  // Another student's attempt looks the same as a missing one.
  if (!attempt || attempt.studentId !== actor.id) throw errors.notFound("Attempt not found");
  return attempt;
}

/** Starts (or resumes) an attempt; the deadline comes from the server clock, never from the client. */
export async function startAttempt(db: Db, actor: Actor, assessmentId: string, classId: string, now: Date) {
  requireRole(actor, STUDENT_ROLES);
  const assessment = await db.assessments.get(assessmentId);
  // A wrong class gets the same answer as a missing assessment.
  if (!assessment || assessment.classId !== classId || !["SCHEDULED", "OPEN"].includes(assessment.status)) throw errors.notFound("Assessment not found");
  const iso = now.toISOString();
  if (iso < assessment.opensAt) throw domainError(409, "ASSESSMENT_NOT_OPEN", "The assessment has not opened yet", { opensAt: assessment.opensAt });
  if (iso >= assessment.closesAt) throw domainError(409, "ASSESSMENT_CLOSED", "The assessment window has closed");

  const questions = (await questionsOf(db, assessmentId)).map(studentQuestion);
  const existing = (await db.attempts.find({ assessmentId, studentId: actor.id }, { limit: 1 }))[0];
  if (existing) {
    if (existing.status !== "IN_PROGRESS") throw domainError(409, "ATTEMPT_ALREADY_SUBMITTED", "You have already submitted this assessment");
    if (iso > existing.dueAt!) throw domainError(409, "ATTEMPT_DEADLINE_PASSED", "Your time is up");
    const answers = await db.attemptAnswers.find({ attemptId: existing.id });
    return { attempt: existing, serverNow: iso, questions, answers: answers.map(({ questionId, response }) => ({ questionId, response })) };
  }

  const accommodation = (await db.accommodations.find({ assessmentId, studentId: actor.id }, { limit: 1 }))[0];
  const extraMinutes = accommodation?.extraMinutes ?? 0;
  const dueAt = new Date(now.getTime() + (assessment.durationMinutes + extraMinutes) * MS_PER_MINUTE).toISOString();
  const attempt = await db.attempts.insert({ assessmentId, studentId: actor.id, status: "IN_PROGRESS", startedAt: iso, dueAt, submittedAt: null, extraMinutes, score: null });
  if (assessment.status === "SCHEDULED") await db.assessments.update(assessmentId, { status: "OPEN" });
  return { attempt, serverNow: iso, questions, answers: [] };
}

/** Autosaves one answer; refused once the server deadline has passed (the worker auto-submits the attempt). */
export async function saveAttemptAnswer(db: Db, actor: Actor, attemptId: string, questionId: string, response: unknown, now: Date) {
  const attempt = await ownAttempt(db, actor, attemptId);
  if (attempt.status !== "IN_PROGRESS") throw domainError(409, "ATTEMPT_NOT_IN_PROGRESS", "This attempt is no longer open");
  if (now.toISOString() > attempt.dueAt!) throw domainError(409, "ATTEMPT_DEADLINE_PASSED", "Your time is up");
  const question = (await db.assessmentQuestions.get(questionId));
  if (!question || question.assessmentId !== attempt.assessmentId) throw errors.notFound("Question not found");
  const problem = responseProblem(question, response);
  if (problem) throw errors.validation(problem, { fields: [{ path: "response", message: problem }] });

  const existing = (await db.attemptAnswers.find({ attemptId, questionId }, { limit: 1 }))[0];
  if (existing) await db.attemptAnswers.update(existing.id, { response });
  else await db.attemptAnswers.insert({ attemptId, questionId, response, marksAwarded: null });
  return { savedAt: now.toISOString() };
}

// Sets auto-markable marks, then finishes marking only when nothing needs a teacher and a grading system exists.
async function finaliseSubmission(db: Db, attempt: Attempt, status: "SUBMITTED" | "AUTO_SUBMITTED", submittedAt: string, now: Date): Promise<Attempt> {
  const questions = await questionsOf(db, attempt.assessmentId);
  const specs = await db.calcSpecs.find({ questionId: questions.map((q) => q.id) });
  const answers = await db.attemptAnswers.find({ attemptId: attempt.id });
  let needsTeacher = false;
  for (const answer of answers) {
    const q = questions.find((x) => x.id === answer.questionId)!;
    const marks = autoMark(q, specs.find((s) => s.questionId === q.id), answer.response);
    if (marks === null) needsTeacher = true;
    else await db.attemptAnswers.update(answer.id, { marksAwarded: marks });
  }
  const submitted = (await db.attempts.update(attempt.id, { status, submittedAt }))!;
  if (needsTeacher || !(await getActiveSystem(db))) return submitted;
  return completeMarking(db, submitted, now);
}

/** Submits an attempt; after the deadline it is recorded as AUTO_SUBMITTED with the answers saved in time. */
export async function submitAttempt(db: Db, actor: Actor, attemptId: string, now: Date): Promise<Attempt> {
  const attempt = await ownAttempt(db, actor, attemptId);
  if (attempt.status !== "IN_PROGRESS") throw domainError(409, "ATTEMPT_NOT_IN_PROGRESS", "This attempt is no longer open");
  const late = now.toISOString() > attempt.dueAt!;
  return finaliseSubmission(db, attempt, late ? "AUTO_SUBMITTED" : "SUBMITTED", late ? attempt.dueAt! : now.toISOString(), now);
}

/** Auto-submits every expired in-progress attempt of one school; returns how many it closed. */
export async function autoSubmitSchool(db: Db, now: Date): Promise<number> {
  const due = await db.attempts.find({ status: "IN_PROGRESS" }, { lt: { dueAt: now.toISOString() } });
  for (const attempt of due) await finaliseSubmission(db, attempt, "AUTO_SUBMITTED", attempt.dueAt!, now);
  for (const assessmentId of new Set(due.map((a) => a.assessmentId))) await refreshAssessmentStatus(db, assessmentId, now);
  return due.length;
}

// Sums marks, stores the result and moves the attempt to MARKED.
async function completeMarking(db: Db, attempt: Attempt, now: Date): Promise<Attempt> {
  const assessment = (await db.assessments.get(attempt.assessmentId))!;
  const questions = await questionsOf(db, attempt.assessmentId);
  const answers = await db.attemptAnswers.find({ attemptId: attempt.id });
  const raw = answers.reduce((sum, a) => sum + (a.marksAwarded ?? 0), 0);
  const total = questions.reduce((sum, q) => sum + q.marks, 0);
  await recordResult(db, assessment, attempt, raw, total);
  const marked = (await db.attempts.update(attempt.id, { status: "MARKED", score: raw }))!;
  await refreshAssessmentStatus(db, attempt.assessmentId, now);
  return marked;
}

// An assessment is CLOSED once its window ends and MARKED once every attempt is marked; release is checked separately.
async function refreshAssessmentStatus(db: Db, assessmentId: string, now: Date): Promise<void> {
  const assessment: Assessment | undefined = await db.assessments.get(assessmentId);
  if (!assessment || ["DRAFT", "MARKED", "RELEASED"].includes(assessment.status) || now.toISOString() < assessment.closesAt) return;
  const attempts = await db.attempts.find({ assessmentId }, { limit: 5000 });
  const allMarked = attempts.length > 0 && attempts.every((a) => a.status === "MARKED");
  await db.assessments.update(assessmentId, { status: allMarked ? "MARKED" : "CLOSED" });
}

/** Records a teacher's marks; finalise needs every answered short answer marked and an active grading system. */
export async function markAttempt(db: Db, actor: Actor, attemptId: string, input: { marks: { questionId: string; marks: number }[]; finalise: boolean }, now: Date): Promise<Attempt> {
  requireRole(actor, TEACHER_ROLES);
  const attempt = await db.attempts.get(attemptId);
  if (!attempt) throw errors.notFound("Attempt not found");
  const assessment = (await db.assessments.get(attempt.assessmentId))!;
  if (assessment.teacherId !== actor.id && !isAdmin(actor)) throw errors.forbidden("Not your assessment");
  if (!MARKABLE.includes(attempt.status)) throw domainError(409, "ATTEMPT_NOT_SUBMITTED", "The attempt has not been submitted");

  const questions = await questionsOf(db, attempt.assessmentId);
  const answers = await db.attemptAnswers.find({ attemptId });
  for (const { questionId, marks } of input.marks) {
    const q = questions.find((x) => x.id === questionId);
    const answer = answers.find((a) => a.questionId === questionId);
    if (!q || !answer) throw errors.validation("No submitted answer for that question", { questionId });
    if (marks > q.marks) throw errors.validation("Marks exceed the question maximum", { questionId, max: q.marks });
    await db.attemptAnswers.update(answer.id, { marksAwarded: marks });
  }
  if (!input.finalise) return (await db.attempts.update(attemptId, { status: "UNDER_MARKING" }))!;

  const fresh = await db.attemptAnswers.find({ attemptId });
  const pending = fresh.filter((a) => a.marksAwarded === null).map((a) => a.questionId);
  if (pending.length > 0) throw domainError(409, "ATTEMPT_UNMARKED_ANSWERS", "Some answers still need marks", { questionIds: pending });
  return completeMarking(db, attempt, now);
}

/** Returns a placeholder object key for a paper scan; real signed upload URLs are issued by the documents service. */
export async function requestScanUploadLink(db: Db, actor: Actor, attemptId: string) {
  requireRole(actor, TEACHER_ROLES);
  const attempt = await db.attempts.get(attemptId);
  if (!attempt) throw errors.notFound("Attempt not found");
  const objectKey = `scans/${actor.schoolId}/${attemptId}/${crypto.randomUUID()}.pdf`;
  await db.paperScans.insert({ attemptId, objectKey, createdBy: actor.id });
  return { objectKey, uploadUrl: null };
}
