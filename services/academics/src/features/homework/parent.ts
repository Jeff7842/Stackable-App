import { errors } from "@stackable/service-kit";
import { PARENT_ROLES, isAdmin, requireRole, type Actor } from "../../lib/auth";
import type { Db } from "../../store/tables";

export interface AiUsage {
  hints: number;
  practice: number;
}

// Callers prove the parent-child link at the gateway; here a parent may only ask as themselves.
function requireSelf(actor: Actor, parentId: string): void {
  if (isAdmin(actor)) return;
  requireRole(actor, PARENT_ROLES);
  if (actor.id !== parentId) throw errors.forbidden("You can only view your own children");
}

/** Parent read model: status, dates, teacher comment and AI usage counts. Never answers, keys or transcripts. */
export async function parentHomework(db: Db, actor: Actor, parentId: string, studentId: string, aiUsage: AiUsage) {
  requireSelf(actor, parentId);
  const submissions = await db.submissions.find({ studentId });
  const assignments = await db.assignments.getMany(submissions.map((s) => s.assignmentId));
  const decisions = await db.reviewDecisions.find({ submissionId: submissions.map((s) => s.id) }, { orderBy: "createdAt" });
  return {
    studentId,
    aiUsage,
    items: submissions.map((s) => {
      const a = assignments.find((x) => x.id === s.assignmentId)!;
      const latest = decisions.filter((d) => d.submissionId === s.id).pop();
      return {
        submissionId: s.id, assignmentId: a.id, title: a.title, status: s.status, dueAt: a.dueAt, closesAt: a.closesAt,
        submittedAt: s.submittedAt, late: s.late, teacherComment: latest?.reason ?? null,
      };
    }),
  };
}

/** Lets a parent acknowledge a child's reviewed work and leave a comment; one review per parent and submission. */
export async function parentReview(db: Db, actor: Actor, parentId: string, studentId: string, submissionId: string, input: { acknowledged: boolean; comment?: string }) {
  requireSelf(actor, parentId);
  const submission = await db.submissions.get(submissionId);
  if (!submission || submission.studentId !== studentId) throw errors.notFound("Submission not found");
  const fields = { acknowledged: input.acknowledged, comment: input.comment ?? null };
  const existing = (await db.parentReviews.find({ submissionId, parentId }, { limit: 1 }))[0];
  const saved = existing ? (await db.parentReviews.update(existing.id, fields))! : await db.parentReviews.insert({ submissionId, parentId, ...fields });
  return { submissionId, acknowledged: saved.acknowledged, comment: saved.comment };
}
