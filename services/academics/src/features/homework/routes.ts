import type { createService } from "@stackable/service-kit";
import { SERVICE_ROLES, STUDENT_ROLES, TEACHER_ROLES, actorOf, requireRole } from "../../lib/auth";
import type { Clock } from "../../lib/clock";
import { externalId, parse, readJson, uuid, object } from "../../lib/validate";
import type { Store } from "../../store/tables";
import { closeAssignment, createAssignment, getAssignment, listAssignments, publishAssignment } from "./assignments";
import { parentHomework, parentReview } from "./parent";
import {
  createAssignmentSchema, gateSchema, listAssignmentsQuery, openSubmissionSchema, parentQuery, parentReviewSchema, reviewSchema, saveAnswerSchema,
} from "./schema";
import { listSubmissions, openSubmission, reviewSubmission, saveAnswer, setAnswerGate, submitSubmission } from "./submissions";

const ids = (c: { req: { param(): Record<string, string> } }, ...names: string[]) =>
  parse(object(Object.fromEntries(names.map((n) => [n, uuid()]))), c.req.param()) as Record<string, string>;

/** Registers the homework endpoints; every handler parses input, then calls one service function in one transaction. */
export function homeworkRoutes(app: ReturnType<typeof createService>, store: Store, now: Clock): void {
  app.post("/v1/homework/assignments", async (c) => {
    const actor = actorOf(c);
    requireRole(actor, TEACHER_ROLES);
    const input = parse(createAssignmentSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => createAssignment(db, actor, input)), 201);
  });

  app.get("/v1/homework/assignments", async (c) => {
    const actor = actorOf(c);
    const query = parse(listAssignmentsQuery, c.req.query());
    return c.json({ items: await store.tx(actor.schoolId, (db) => listAssignments(db, actor, query)) });
  });

  app.get("/v1/homework/assignments/:id", async (c) => {
    const actor = actorOf(c);
    const { id } = ids(c, "id");
    return c.json(await store.tx(actor.schoolId, (db) => getAssignment(db, actor, id)));
  });

  app.post("/v1/homework/assignments/:id/publish", async (c) => {
    const actor = actorOf(c);
    const { id } = ids(c, "id");
    return c.json(await store.tx(actor.schoolId, (db) => publishAssignment(db, actor, id)));
  });

  app.post("/v1/homework/assignments/:id/close", async (c) => {
    const actor = actorOf(c);
    const { id } = ids(c, "id");
    return c.json(await store.tx(actor.schoolId, (db) => closeAssignment(db, actor, id)));
  });

  app.get("/v1/homework/assignments/:id/submissions", async (c) => {
    const actor = actorOf(c);
    const { id } = ids(c, "id");
    return c.json({ items: await store.tx(actor.schoolId, (db) => listSubmissions(db, actor, id)) });
  });

  app.post("/v1/homework/assignments/:id/open", async (c) => {
    const actor = actorOf(c);
    requireRole(actor, STUDENT_ROLES);
    const { id } = ids(c, "id");
    const { classId } = parse(openSubmissionSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => openSubmission(db, actor, id, classId)));
  });

  app.put("/v1/homework/submissions/:id/answers/:itemId", async (c) => {
    const actor = actorOf(c);
    const { id, itemId } = ids(c, "id", "itemId");
    const input = parse(saveAnswerSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => saveAnswer(db, actor, id, itemId, input)));
  });

  app.post("/v1/homework/submissions/:id/submit", async (c) => {
    const actor = actorOf(c);
    const { id } = ids(c, "id");
    return c.json(await store.tx(actor.schoolId, (db) => submitSubmission(db, actor, id, now())));
  });

  app.post("/v1/homework/submissions/:id/review", async (c) => {
    const actor = actorOf(c);
    requireRole(actor, TEACHER_ROLES);
    const { id } = ids(c, "id");
    const input = parse(reviewSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => reviewSubmission(db, actor, id, input)));
  });

  // Set by the ai service when a hint or practice step locks or unlocks submission.
  app.post("/v1/answers/:id/gate", async (c) => {
    const actor = actorOf(c);
    requireRole(actor, SERVICE_ROLES);
    const { id } = ids(c, "id");
    const { locked } = parse(gateSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => setAnswerGate(db, actor, id, locked)));
  });

  app.get("/v1/parents/:parentId/children/:studentId/homework", async (c) => {
    const actor = actorOf(c);
    const { parentId, studentId } = parse(object({ parentId: externalId(), studentId: externalId() }), c.req.param());
    const q = parse(parentQuery, c.req.query());
    const usage = { hints: q.aiHints ?? 0, practice: q.aiPractice ?? 0 };
    return c.json(await store.tx(actor.schoolId, (db) => parentHomework(db, actor, parentId, studentId, usage)));
  });

  app.post("/v1/parents/:parentId/children/:studentId/homework/:submissionId/review", async (c) => {
    const actor = actorOf(c);
    const p = parse(object({ parentId: externalId(), studentId: externalId(), submissionId: uuid() }), c.req.param());
    const input = parse(parentReviewSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => parentReview(db, actor, p.parentId, p.studentId, p.submissionId, input)));
  });
}
