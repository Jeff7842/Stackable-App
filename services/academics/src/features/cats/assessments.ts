import { errors } from "@stackable/service-kit";
import { STUDENT_ROLES, TEACHER_ROLES, domainError, isAdmin, requireRole, type Actor } from "../../lib/auth";
import type { Db } from "../../store/tables";
import type { CreateAssessmentInput } from "./schema";
import type { Assessment, AssessmentQuestion, Choice } from "./types";

type QuestionInput = CreateAssessmentInput["questions"][number];

// Builds the stored choices and key for one question, rejecting inputs that cannot be marked.
function buildQuestionParts(q: QuestionInput): { choices: Choice[] | null; answerKey: unknown } {
  const fail = (message: string) => errors.validation(message, { stem: q.stem });
  if (q.type === "multiple_choice") {
    const options = q.choices ?? [];
    if (options.filter((o) => o.isCorrect).length !== 1) throw fail("A multiple choice question needs exactly one correct choice");
    const choices = options.map((o) => ({ id: crypto.randomUUID(), label: o.label }));
    return { choices, answerKey: choices[options.findIndex((o) => o.isCorrect)].id };
  }
  if (q.type === "reorder") {
    if (!q.items) throw fail("A reorder question needs its items in the correct order");
    const choices = q.items.map((label) => ({ id: crypto.randomUUID(), label }));
    return { choices, answerKey: choices.map((c) => c.id) };
  }
  if (q.type === "calculation") {
    if (q.expectedValue === undefined || q.tolerance === undefined) throw fail("A calculation question needs expectedValue and tolerance");
    return { choices: null, answerKey: null };
  }
  return { choices: null, answerKey: q.modelAnswer ?? null };
}

/** Creates a DRAFT cat or quiz with its questions; keys are stored but never returned to students. */
export async function createAssessment(db: Db, actor: Actor, input: CreateAssessmentInput): Promise<Assessment> {
  requireRole(actor, TEACHER_ROLES);
  if (input.closesAt <= input.opensAt) throw errors.validation("closesAt must be after opensAt");
  const assessment = await db.assessments.insert({
    title: input.title, type: input.type, classId: input.classId, subjectId: input.subjectId ?? null, teacherId: actor.id,
    durationMinutes: input.durationMinutes, opensAt: input.opensAt, closesAt: input.closesAt, status: "DRAFT",
  });
  for (const [index, q] of input.questions.entries()) {
    const { choices, answerKey } = buildQuestionParts(q);
    const stored = await db.assessmentQuestions.insert({ assessmentId: assessment.id, position: index + 1, type: q.type, stem: q.stem, marks: q.marks, choices, answerKey });
    if (q.type === "calculation") await db.calcSpecs.insert({ questionId: stored.id, expectedValue: q.expectedValue!, tolerance: q.tolerance! });
  }
  return assessment;
}

async function ownedAssessment(db: Db, actor: Actor, id: string): Promise<Assessment> {
  const assessment = await db.assessments.get(id);
  if (!assessment) throw errors.notFound("Assessment not found");
  if (assessment.teacherId !== actor.id && !isAdmin(actor)) throw errors.forbidden("Not your assessment");
  return assessment;
}

/** Moves a DRAFT assessment to SCHEDULED so students of its class can start inside the window. */
export async function scheduleAssessment(db: Db, actor: Actor, id: string): Promise<Assessment> {
  requireRole(actor, TEACHER_ROLES);
  const assessment = await ownedAssessment(db, actor, id);
  if (assessment.status !== "DRAFT") throw domainError(409, "ASSESSMENT_NOT_DRAFT", "Only a draft can be scheduled");
  const windowMinutes = (Date.parse(assessment.closesAt) - Date.parse(assessment.opensAt)) / 60_000;
  if (assessment.durationMinutes > windowMinutes) throw errors.validation("Duration is longer than the window");
  return (await db.assessments.update(id, { status: "SCHEDULED" }))!;
}

export async function listAssessments(db: Db, actor: Actor, classId?: string) {
  if ((STUDENT_ROLES as readonly string[]).includes(actor.role)) {
    if (!classId) throw errors.validation("classId is required", { fields: [{ path: "classId", message: "is required" }] });
    const open = await db.assessments.find({ classId, status: ["SCHEDULED", "OPEN"] });
    return open.map(({ id, title, type, durationMinutes, opensAt, closesAt, status }) => ({ id, title, type, classId, durationMinutes, opensAt, closesAt, status }));
  }
  requireRole(actor, TEACHER_ROLES);
  return db.assessments.find({ teacherId: isAdmin(actor) ? undefined : actor.id, classId });
}

/** Gives one student extra minutes; the attempt deadline adds them when the student starts. */
export async function setAccommodation(db: Db, actor: Actor, id: string, studentId: string, extraMinutes: number) {
  requireRole(actor, TEACHER_ROLES);
  await ownedAssessment(db, actor, id);
  const existing = (await db.accommodations.find({ assessmentId: id, studentId }, { limit: 1 }))[0];
  if (existing) return (await db.accommodations.update(existing.id, { extraMinutes }))!;
  return db.accommodations.insert({ assessmentId: id, studentId, extraMinutes });
}

export async function questionsOf(db: Db, assessmentId: string): Promise<AssessmentQuestion[]> {
  return db.assessmentQuestions.find({ assessmentId }, { orderBy: "position", limit: 200 });
}
