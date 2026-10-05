import type { createService } from "@stackable/service-kit";
import { ADMIN_ROLES, actorOf, requireRole } from "../../lib/auth";
import type { Clock } from "../../lib/clock";
import { object, parse, readJson, uuid } from "../../lib/validate";
import type { Store } from "../../store/tables";
import { releaseAssessment } from "./release";
import { listResults } from "./results";
import { createSystemSchema, passMarkSchema } from "./schema";
import { activateSystem, createSystem, listSystems, setPassMark } from "./service";

const idParam = object({ id: uuid() });

/** Registers grading and release endpoints. Release needs the `rel` claim set by the gateway after the security-code check. */
export function gradingRoutes(app: ReturnType<typeof createService>, store: Store, now: Clock): void {
  app.post("/v1/grading/systems", async (c) => {
    const actor = actorOf(c);
    requireRole(actor, ADMIN_ROLES);
    const input = parse(createSystemSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => createSystem(db, actor, input)), 201);
  });

  app.get("/v1/grading/systems", async (c) => {
    const actor = actorOf(c);
    return c.json({ items: await store.tx(actor.schoolId, (db) => listSystems(db)) });
  });

  app.post("/v1/grading/systems/:id/activate", async (c) => {
    const actor = actorOf(c);
    const { id } = parse(idParam, c.req.param());
    return c.json(await store.tx(actor.schoolId, (db) => activateSystem(db, actor, id)));
  });

  app.put("/v1/grading/systems/:id/pass-marks", async (c) => {
    const actor = actorOf(c);
    requireRole(actor, ADMIN_ROLES);
    const { id } = parse(idParam, c.req.param());
    const { subjectId, passPct } = parse(passMarkSchema, await readJson(c));
    return c.json(await store.tx(actor.schoolId, (db) => setPassMark(db, actor, id, subjectId ?? null, passPct)));
  });

  app.get("/v1/assessments/:id/results", async (c) => {
    const actor = actorOf(c);
    const { id } = parse(idParam, c.req.param());
    return c.json({ items: await store.tx(actor.schoolId, (db) => listResults(db, actor, id)) });
  });

  app.post("/v1/assessments/:id/release", async (c) => {
    const actor = actorOf(c);
    const { id } = parse(idParam, c.req.param());
    return c.json(await store.tx(actor.schoolId, (db) => releaseAssessment(db, actor, id, now())));
  });
}
