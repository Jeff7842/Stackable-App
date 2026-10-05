import { errors } from "@stackable/service-kit";
import { STUDENT_ROLES, TEACHER_ROLES, domainError, isAdmin, requireRole, type Actor } from "../../lib/auth";
import { emit } from "../../lib/outbox";
import type { Db } from "../../store/tables";
import type { CreateAssignmentInput } from "./schema";
import type { Assignment, AssignmentStatus } from "./types";

type ItemInput = CreateAssignmentInput["items"][number];

function checkQuestion(item: ItemInput): void {
  const { type, options } = item.question;
  if (type === "multiple_choice") {
    if (!options || options.filter((o) => o.isCorrect).length !== 1) {
      throw errors.validation("A multiple choice question needs exactly one correct option", { stem: item.question.stem });
    }
  } else if (options) {
    throw errors.validation("Only multiple choice questions have options", { stem: item.question.stem });
  }
}

async function ownedAssignment(db: Db, actor: Actor, id: string): Promise<Assignment> {
  requireRole(actor, TEACHER_ROLES);
  const assignment = await db.assignments.get(id);
  if (!assignment) throw errors.notFound("Assignment not found");
  if (assignment.teacherId !== actor.id && !isAdmin(actor)) throw errors.forbidden("Not your assignment");
  return assignment;
}

/** Creates a DRAFT assignment with its questions and items in the caller's transaction. */
export async function createAssignment(db: Db, actor: Actor, input: CreateAssignmentInput): Promise<Assignment> {
  requireRole(actor, TEACHER_ROLES);
  if (input.closesAt < input.dueAt) throw errors.validation("closesAt must not be before dueAt");
  input.items.forEach(checkQuestion);
  const assignment = await db.assignments.insert({
    classId: input.classId, subjectId: input.subjectId, teacherId: actor.id, title: input.title,
    dueAt: input.dueAt, closesAt: input.closesAt, status: "DRAFT",
  });
  for (const [index, item] of input.items.entries()) {
    const q = item.question;
    const question = await db.questions.insert({ type: q.type, stem: q.stem, marks: item.marks, answerKey: q.answerKey ?? null, createdBy: actor.id });
    for (const [position, o] of (q.options ?? []).entries()) {
      await db.questionOptions.insert({ questionId: question.id, position: position + 1, label: o.label, isCorrect: o.isCorrect });
    }
    await db.assignmentItems.insert({ assignmentId: assignment.id, questionId: question.id, position: index + 1, marks: item.marks });
  }
  return assignment;
}

/** Opens a DRAFT assignment to students and queues assignment.published for the notification service. */
export async function publishAssignment(db: Db, actor: Actor, id: string): Promise<Assignment> {
  const assignment = await ownedAssignment(db, actor, id);
  if (assignment.status !== "DRAFT") throw domainError(409, "HOMEWORK_NOT_DRAFT", "Only a draft can be published");
  const published = (await db.assignments.update(id, { status: "OPEN" }))!;
  await emit(db, "assignment.published", {
    assignmentId: id, classId: published.classId, subjectId: published.subjectId, title: published.title,
    dueAt: published.dueAt, closesAt: published.closesAt,
  });
  return published;
}

/** Stops new work on an OPEN assignment. */
export async function closeAssignment(db: Db, actor: Actor, id: string): Promise<Assignment> {
  const assignment = await ownedAssignment(db, actor, id);
  if (assignment.status !== "OPEN") throw domainError(409, "HOMEWORK_NOT_OPEN", "Only an open assignment can be closed");
  return (await db.assignments.update(id, { status: "CLOSED" }))!;
}

export async function listAssignments(db: Db, actor: Actor, query: { classId?: string; status?: AssignmentStatus }) {
  if ((STUDENT_ROLES as readonly string[]).includes(actor.role)) {
    if (!query.classId) throw errors.validation("classId is required", { fields: [{ path: "classId", message: "is required" }] });
    const open = await db.assignments.find({ classId: query.classId, status: ["OPEN", "CLOSED"] });
    const mine = await db.submissions.find({ studentId: actor.id, assignmentId: open.map((a) => a.id) });
    return open.map((a) => {
      const s = mine.find((x) => x.assignmentId === a.id);
      const { id, title, subjectId, classId, dueAt, closesAt, status } = a;
      return { id, title, subjectId, classId, dueAt, closesAt, status, submission: s ? { id: s.id, status: s.status, late: s.late } : null };
    });
  }
  requireRole(actor, TEACHER_ROLES);
  return db.assignments.find({ teacherId: isAdmin(actor) ? undefined : actor.id, classId: query.classId, status: query.status });
}

/** Full assignment; answer keys and correct flags are included only for the teacher view. */
export async function getAssignment(db: Db, actor: Actor, id: string) {
  requireRole(actor, [...TEACHER_ROLES, ...STUDENT_ROLES]);
  const assignment = await db.assignments.get(id);
  const isTeacher = (TEACHER_ROLES as readonly string[]).includes(actor.role);
  if (!assignment || (!isTeacher && assignment.status === "DRAFT")) throw errors.notFound("Assignment not found");
  if (isTeacher && assignment.teacherId !== actor.id && !isAdmin(actor)) throw errors.forbidden("Not your assignment");

  const items = await db.assignmentItems.find({ assignmentId: id }, { orderBy: "position", limit: 100 });
  const questions = await db.questions.getMany(items.map((i) => i.questionId));
  const options = await db.questionOptions.find({ questionId: items.map((i) => i.questionId) }, { orderBy: "position", limit: 2000 });
  return {
    ...assignment,
    items: items.map((item) => {
      const q = questions.find((x) => x.id === item.questionId)!;
      const opts = options.filter((o) => o.questionId === q.id);
      return {
        id: item.id, position: item.position, marks: item.marks,
        question: {
          type: q.type, stem: q.stem,
          ...(isTeacher ? { answerKey: q.answerKey } : {}),
          ...(opts.length > 0 ? { options: opts.map((o) => ({ id: o.id, label: o.label, ...(isTeacher ? { isCorrect: o.isCorrect } : {}) })) } : {}),
        },
      };
    }),
  };
}
