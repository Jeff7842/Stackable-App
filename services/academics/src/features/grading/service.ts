import { errors } from "@stackable/service-kit";
import { ADMIN_ROLES, domainError, requireRole, type Actor } from "../../lib/auth";
import type { Db } from "../../store/tables";
import type { Assessment, Attempt } from "../cats/types";
import { gradeFor, isPass, normalise, validateBands, type BandInput } from "./bands";
import type { AssessmentResult, GradeBand, GradingSystem, PassMark } from "./types";

export const DEFAULT_PASS_PCT = 50; // used only when a school has configured no pass mark

export interface CreateSystemInput {
  name: string;
  effectiveFrom: string;
  bands: BandInput[];
  passMarks?: { subjectId?: string; passPct: number }[];
}

/** Creates an inactive grading system after proving its bands cover 0 to 100 exactly once. */
export async function createSystem(db: Db, actor: Actor, input: CreateSystemInput): Promise<GradingSystem> {
  requireRole(actor, ADMIN_ROLES);
  const issues = validateBands(input.bands);
  if (issues.length > 0) throw domainError(400, "GRADING_BANDS_INVALID", "Grade bands are not a clean 0 to 100 cover", { issues });
  const system = await db.gradingSystems.insert({ name: input.name, effectiveFrom: input.effectiveFrom, active: false });
  for (const b of input.bands) {
    await db.gradeBands.insert({ systemId: system.id, minPct: b.minPct, maxPct: b.maxPct, grade: b.grade, points: b.points, remark: b.remark ?? null });
  }
  const seen = new Set<string | null>();
  for (const m of input.passMarks ?? []) {
    const key = m.subjectId ?? null;
    if (seen.has(key)) throw errors.validation("Duplicate pass mark for the same subject", { subjectId: key });
    seen.add(key);
    await db.passMarks.insert({ systemId: system.id, subjectId: key, passPct: m.passPct });
  }
  return system;
}

/** Sets the default (no subject) or a per-subject pass mark; one row per system and subject. */
export async function setPassMark(db: Db, actor: Actor, systemId: string, subjectId: string | null, passPct: number): Promise<PassMark> {
  requireRole(actor, ADMIN_ROLES);
  if (!(await db.gradingSystems.get(systemId))) throw errors.notFound("Grading system not found");
  const existing = (await db.passMarks.find({ systemId, subjectId }, { limit: 1 }))[0];
  if (existing) return (await db.passMarks.update(existing.id, { passPct }))!;
  return db.passMarks.insert({ systemId, subjectId, passPct });
}

export async function listSystems(db: Db): Promise<GradingSystem[]> {
  return db.gradingSystems.find({}, { orderBy: "effectiveFrom" });
}

/** Makes one system the active one; the old system keeps its bands so old results stay explainable. */
export async function activateSystem(db: Db, actor: Actor, systemId: string): Promise<GradingSystem> {
  requireRole(actor, ADMIN_ROLES);
  const system = await db.gradingSystems.get(systemId);
  if (!system) throw errors.notFound("Grading system not found");
  await db.gradingSystems.updateMany({ active: true }, { active: false });
  return (await db.gradingSystems.update(systemId, { active: true }))!;
}

export async function getActiveSystem(db: Db): Promise<GradingSystem | undefined> {
  return (await db.gradingSystems.find({ active: true }, { limit: 1 }))[0];
}

/** Computes and stores one student's result with the active system; refuses to change a released result. */
export async function recordResult(db: Db, assessment: Assessment, attempt: Attempt, raw: number, total: number): Promise<AssessmentResult> {
  const system = await getActiveSystem(db);
  if (!system) throw domainError(409, "GRADING_NOT_CONFIGURED", "No active grading system");
  const bands: GradeBand[] = await db.gradeBands.find({ systemId: system.id });
  const pct = normalise(raw, total);
  const band = gradeFor(pct, bands);
  const marks: PassMark[] = await db.passMarks.find({ systemId: system.id });
  const mark = marks.find((m) => m.subjectId !== null && m.subjectId === assessment.subjectId) ?? marks.find((m) => m.subjectId === null);
  const fields = {
    attemptId: attempt.id, systemId: system.id, raw, total, pct, grade: band.grade, points: band.points,
    remark: band.remark, isPass: isPass(pct, mark?.passPct ?? DEFAULT_PASS_PCT),
  };
  const existing = (await db.results.find({ assessmentId: assessment.id, studentId: attempt.studentId }, { limit: 1 }))[0];
  if (!existing) return db.results.insert({ assessmentId: assessment.id, studentId: attempt.studentId, releasedAt: null, ...fields });
  if (existing.releasedAt) throw domainError(409, "RESULT_ALREADY_RELEASED", "Released results cannot change");
  return (await db.results.update(existing.id, fields))!;
}
