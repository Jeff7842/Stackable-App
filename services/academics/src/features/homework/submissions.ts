import { errors } from "@stackable/service-kit";
import { SERVICE_ROLES, STUDENT_ROLES, TEACHER_ROLES, domainError, isAdmin, requireRole, type Actor } from "../../lib/auth";
import type { Db } from "../../store/tables";
import type { Assignment, ReviewDecisionValue, Submission } from "./types";

const EDITABLE: Submission["status"][] = ["IN_PROGRESS", "RETURNED"];
const NEEDS_REASON: ReviewDecisionValue[] = ["RETURNED", "REJECTED"];

async function ownSubmission(db: Db, actor: Actor, id: string): Promise<{ submission: Submission; assignment: Assignment }> {
  requireRole(actor, STUDENT_ROLES);
  const submission = await db.submissions.get(id);
  // Another student's submission looks the same as a missing one.
  if (!submission || submission.studentId !== actor.id) throw errors.notFound("Submission not found");
  const assignment = (await db.assignments.get(submission.assignmentId))!;
  return { submission, assignment };
}

/** Starts (or resumes) the student's submission; only an OPEN assignment of the student's class. */
export async function openSubmission(db: Db, actor: Actor, assignmentId: string, classId: string) {
  requireRole(actor, STUDENT_ROLES);
  const assignment = await db.assignments.get(assignmentId);
  if (!assignment || assignment.classId !== classId || assignment.status !== "OPEN") throw errors.notFound("Assignment not found");
  let submission = (await db.submissions.find({ assignmentId, studentId: actor.id }, { limit: 1 }))[0];
  if (!submission) {
    submission = await db.submissions.insert({ assignmentId, studentId: actor.id, status: "IN_PROGRESS", submittedAt: null, late: false });
  }
  const answers = await db.answers.find({ submissionId: submission.id });
  return { submission, answers: answers.map(({ id, itemId, responseText, selectedOptionId }) => ({ id, itemId, responseText, selectedOptionId })) };
}

/** Saves one answer; a returned submission goes back to IN_PROGRESS when the student edits it. */
export async function saveAnswer(db: Db, actor: Actor, submissionId: string, itemId: string, input: { responseText?: string; selectedOptionId?: string }) {
  const { submission, assignment } = await ownSubmission(db, actor, submissionId);
  if (!EDITABLE.includes(submission.status)) throw domainError(409, "HOMEWORK_NOT_EDITABLE", "This submission can no longer be edited");
  if (assignment.status !== "OPEN") throw domainError(409, "HOMEWORK_CLOSED", "This assignment is closed");
  const item = await db.assignmentItems.get(itemId);
  if (!item || item.assignmentId !== assignment.id) throw errors.notFound("Item not found");
  if (input.selectedOptionId) {
    const options = await db.questionOptions.find({ questionId: item.questionId });
    if (!options.some((o) => o.id === input.selectedOptionId)) throw errors.validation("Unknown option for this question");
  }
  const fields = { responseText: input.responseText ?? null, selectedOptionId: input.selectedOptionId ?? null };
  const existing = (await db.answers.find({ submissionId, itemId }, { limit: 1 }))[0];
  const saved = existing ? (await db.answers.update(existing.id, fields))! : await db.answers.insert({ submissionId, itemId, marksAwarded: null, aiGateLocked: false, ...fields });
  if (submission.status === "RETURNED") await db.submissions.update(submissionId, { status: "IN_PROGRESS" });
  return { id: saved.id, itemId, responseText: saved.responseText, selectedOptionId: saved.selectedOptionId };
}

/** Sets the AI answer gate on one answer; only the ai service (or a service token) may do this. */
export async function setAnswerGate(db: Db, actor: Actor, answerId: string, locked: boolean) {
  requireRole(actor, SERVICE_ROLES);
  const answer = await db.answers.update(answerId, { aiGateLocked: locked });
  if (!answer) throw errors.notFound("Answer not found");
  return { id: answer.id, aiGateLocked: answer.aiGateLocked };
}

/** Submits; accepted after closesAt but flagged late, refused while any answer is gate-locked. */
export async function submitSubmission(db: Db, actor: Actor, submissionId: string, now: Date) {
  const { submission, assignment } = await ownSubmission(db, actor, submissionId);
  if (!EDITABLE.includes(submission.status)) throw domainError(409, "HOMEWORK_NOT_EDITABLE", "This submission was already submitted");
  if (assignment.status !== "OPEN") throw domainError(409, "HOMEWORK_CLOSED", "This assignment is closed");
  const answers = await db.answers.find({ submissionId });
  const locked = answers.filter((a) => a.aiGateLocked);
  if (locked.length > 0) {
    throw domainError(409, "HOMEWORK_AI_GATE_LOCKED", "Finish the AI practice steps before submitting", { answerIds: locked.map((a) => a.id) });
  }

  const items = await db.assignmentItems.find({ assignmentId: assignment.id }, { limit: 100 });
  const questions = await db.questions.getMany(items.map((i) => i.questionId));
  const options = await db.questionOptions.find({ questionId: questions.filter((q) => q.type === "multiple_choice").map((q) => q.id) }, { limit: 2000 });
  for (const answer of answers) {
    const item = items.find((i) => i.id === answer.itemId)!;
    if (questions.find((q) => q.id === item.questionId)?.type !== "multiple_choice") continue;
    const correct = options.find((o) => o.questionId === item.questionId && o.isCorrect);
    await db.answers.update(answer.id, { marksAwarded: correct && answer.selectedOptionId === correct.id ? item.marks : 0 });
  }

  const late = now.toISOString() > assignment.closesAt;
  const updated = await db.submissions.update(submissionId, { status: "SUBMITTED", submittedAt: now.toISOString(), late });
  return { id: submissionId, status: updated!.status, submittedAt: updated!.submittedAt, late };
}

/** Records a review; RETURNED and REJECTED must say why so the student and parent can act on it. */
export async function reviewSubmission(db: Db, actor: Actor, submissionId: string, input: { decision: ReviewDecisionValue; reason?: string }) {
  requireRole(actor, TEACHER_ROLES);
  const submission = await db.submissions.get(submissionId);
  if (!submission) throw errors.notFound("Submission not found");
  const assignment = (await db.assignments.get(submission.assignmentId))!;
  if (assignment.teacherId !== actor.id && !isAdmin(actor)) throw errors.forbidden("Not your assignment");
  if (NEEDS_REASON.includes(input.decision) && !input.reason) {
    throw errors.validation("A reason is required to return or reject work", { fields: [{ path: "reason", message: "is required" }] });
  }
  if (submission.status !== "SUBMITTED") throw domainError(409, "HOMEWORK_NOT_SUBMITTED", "Only submitted work can be reviewed");
  await db.reviewDecisions.insert({ submissionId, decision: input.decision, reason: input.reason || null, reviewerId: actor.id });
  await db.submissions.update(submissionId, { status: input.decision });
  return { id: submissionId, status: input.decision };
}

export async function listSubmissions(db: Db, actor: Actor, assignmentId: string) {
  requireRole(actor, TEACHER_ROLES);
  const assignment = await db.assignments.get(assignmentId);
  if (!assignment) throw errors.notFound("Assignment not found");
  if (assignment.teacherId !== actor.id && !isAdmin(actor)) throw errors.forbidden("Not your assignment");
  return db.submissions.find({ assignmentId });
}
