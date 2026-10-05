import { errors } from "@stackable/service-kit";
import { STUDENT_ROLES, TEACHER_ROLES, isAdmin, requireRole, type Actor } from "../../lib/auth";
import type { Db } from "../../store/tables";

const MAX_RESULTS = 2000;

/** Teachers see every result; a student sees only their own, and only after release. */
export async function listResults(db: Db, actor: Actor, assessmentId: string) {
  const assessment = await db.assessments.get(assessmentId);
  if (!assessment) throw errors.notFound("Assessment not found");
  if ((STUDENT_ROLES as readonly string[]).includes(actor.role)) {
    const mine = await db.results.find({ assessmentId, studentId: actor.id }, { limit: 1 });
    return mine.filter((r) => r.releasedAt !== null);
  }
  requireRole(actor, TEACHER_ROLES);
  if (assessment.teacherId !== actor.id && !isAdmin(actor)) throw errors.forbidden("Not your assessment");
  return db.results.find({ assessmentId }, { limit: MAX_RESULTS });
}
