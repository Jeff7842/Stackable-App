import { errors } from "@stackable/service-kit";
import { TEACHER_ROLES, domainError, isAdmin, requireRole, type Actor } from "../../lib/auth";
import { emit } from "../../lib/outbox";
import type { Db } from "../../store/tables";

const MAX_LISTED_UNMARKED = 50; // keeps the error body small when a whole class is unmarked
const MAX_RELEASE_ROWS = 5000;

/**
 * Publishes every result of an assessment at once. The gateway sets the `rel` claim only after
 * verifying the school security code and enforcing the 5-try lockout; a token without it can never release.
 */
export async function releaseAssessment(db: Db, actor: Actor, assessmentId: string, now: Date) {
  requireRole(actor, TEACHER_ROLES);
  if (!actor.canRelease) throw domainError(403, "RESULTS_RELEASE_FORBIDDEN", "Releasing results needs the school security code");

  const assessment = await db.assessments.get(assessmentId);
  if (!assessment) throw errors.notFound("Assessment not found");
  if (assessment.teacherId !== actor.id && !isAdmin(actor)) throw errors.forbidden("Not your assessment");
  if (assessment.status === "RELEASED") throw domainError(409, "RESULTS_ALREADY_RELEASED", "Results are already released");
  if (now.toISOString() < assessment.closesAt) throw domainError(409, "ASSESSMENT_STILL_OPEN", "The assessment window has not closed");

  const attempts = await db.attempts.find({ assessmentId }, { limit: MAX_RELEASE_ROWS });
  const unmarked = attempts.filter((a) => a.status !== "MARKED");
  if (unmarked.length > 0) {
    throw domainError(409, "RESULTS_UNMARKED_SCRIPTS", "Some scripts are not marked yet", {
      count: unmarked.length,
      attemptIds: unmarked.slice(0, MAX_LISTED_UNMARKED).map((a) => a.id),
    });
  }

  const releasedAt = now.toISOString();
  const count = await db.results.updateMany({ assessmentId, releasedAt: null }, { releasedAt });
  if (count === 0) throw domainError(409, "RESULTS_EMPTY", "There are no results to release");
  await db.assessments.update(assessmentId, { status: "RELEASED" });
  await emit(db, "results.released", { assessmentId, classId: assessment.classId, resultCount: count, releasedAt });
  return { assessmentId, releasedAt, count };
}
