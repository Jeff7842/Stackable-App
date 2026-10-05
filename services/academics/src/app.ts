import type { Pool } from "pg";
import { createService, requireServiceToken, type ReadyCheck } from "@stackable/service-kit";
import { catRoutes } from "./features/cats/routes";
import { gradingRoutes } from "./features/grading/routes";
import { homeworkRoutes } from "./features/homework/routes";
import type { Clock } from "./lib/clock";
import type { Store } from "./store/tables";

export const SERVICE_NAME = "academics";

/** Builds the academics app; pool is optional so dev and tests can run on the in-memory store. */
export function buildApp(store: Store, pool: Pool | undefined, version: string, now: Clock = () => new Date()) {
  const dbCheck: ReadyCheck = pool
    ? { name: "database", run: () => pool.query("select 1") }
    : { name: "database", required: false, run: () => Promise.reject(new Error("DATABASE_URL not set")) };

  const app = createService({ name: SERVICE_NAME, version, checks: [dbCheck] });
  app.use("/v1/*", requireServiceToken(SERVICE_NAME));

  homeworkRoutes(app, store, now);
  catRoutes(app, store, now);
  gradingRoutes(app, store, now);
  return app;
}
