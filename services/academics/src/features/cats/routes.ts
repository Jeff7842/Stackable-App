import type { createService } from "@stackable/service-kit";
import { STUDENT_ROLES, TEACHER_ROLES, actorOf, requireRole } from "../../lib/auth";
import type { Clock } from "../../lib/clock";
import { object, parse, readJson, uuid } from "../../lib/validate";
import type { Store } from "../../store/tables";
import { createAssessment, listAssessments, scheduleAssessment, setAccommodation } from "./assessments";
import { markAttempt, requestScanUploadLink, saveAttemptAnswer, startAttempt, submitAttempt } from "./attempts";
import { accommodationSchema, createAssessmentSchema, listAssessmentsQuery, markAttemptSchema, saveAnswerSchema, startAttemptSchema } from "./schema";

const idParam = object({ id: uuid() });

/** Registers the CAT endpoints; the clock is injected so the server deadline is testable. */
export function catRoutes(app: ReturnType<typeof createService>, store: Store, now: Clock): void {
  app.post("/v1/assessments", async (c) => {
    const actor = actorOf(c);
    requireRole(actor, TEACHER_ROLES);
    const input = parse(createAssessmentSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => createAssessment(db, actor, input)), 201);
  });

  app.get("/v1/assessments", async (c) => {
    const actor = actorOf(c);
    const { classId } = parse(listAssessmentsQuery, c.req.query());
    return c.json({ items: await store.tx(actor.schoolId, (db) => listAssessments(db, actor, classId)) });
  });

  app.post("/v1/assessments/:id/schedule", async (c) => {
    const actor = actorOf(c);
    const { id } = parse(idParam, c.req.param());
    return c.json(await store.tx(actor.schoolId, (db) => scheduleAssessment(db, actor, id)));
  });

  app.post("/v1/assessments/:id/accommodations", async (c) => {
    const actor = actorOf(c);
    requireRole(actor, TEACHER_ROLES);
    const { id } = parse(idParam, c.req.param());
    const { studentId, extraMinutes } = parse(accommodationSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => setAccommodation(db, actor, id, studentId, extraMinutes)), 201);
  });

  app.post("/v1/assessments/:id/attempts", async (c) => {
    const actor = actorOf(c);
    requireRole(actor, STUDENT_ROLES);
    const { id } = parse(idParam, c.req.param());
    const { classId } = parse(startAttemptSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => startAttempt(db, actor, id, classId, now())));
  });

  app.put("/v1/attempts/:id/answers/:questionId", async (c) => {
    const actor = actorOf(c);
    requireRole(actor, STUDENT_ROLES);
    const { id, questionId } = parse(object({ id: uuid(), questionId: uuid() }), c.req.param());
    const { response } = parse(saveAnswerSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => saveAttemptAnswer(db, actor, id, questionId, response, now())));
  });

  app.post("/v1/attempts/:id/submit", async (c) => {
    const actor = actorOf(c);
    const { id } = parse(idParam, c.req.param());
    return c.json(await store.tx(actor.schoolId, (db) => submitAttempt(db, actor, id, now())));
  });

  app.post("/v1/attempts/:id/mark", async (c) => {
    const actor = actorOf(c);
    requireRole(actor, TEACHER_ROLES);
    const { id } = parse(idParam, c.req.param());
    const input = parse(markAttemptSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => markAttempt(db, actor, id, input, now())));
  });

  app.post("/v1/attempts/:id/scan-upload-link", async (c) => {
    const actor = actorOf(c);
    const { id } = parse(idParam, c.req.param());
    return c.json(await store.tx(actor.schoolId, (db) => requestScanUploadLink(db, actor, id)), 201);
  });
}
