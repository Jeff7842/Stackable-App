import type { Pool } from "pg";
import type { MeResponse } from "@stackable/contracts";
import { createService, requireServiceToken, type ReadyCheck } from "@stackable/service-kit";

export const SERVICE_NAME = "identity";

/** Builds the identity app; pool is optional so dev can run without a database. */
export function buildApp(pool: Pool | undefined, version: string) {
  const dbCheck: ReadyCheck = pool
    ? { name: "database", run: () => pool.query("select 1") }
    : { name: "database", required: false, run: () => Promise.reject(new Error("DATABASE_URL not set")) };

  const app = createService({ name: SERVICE_NAME, version, checks: [dbCheck] });

  app.get("/v1/me", requireServiceToken(SERVICE_NAME), (c) => {
    const claims = c.var.claims;
    const body: MeResponse = { userId: claims.sub, schoolId: claims.schoolId, role: claims.role ?? null };
    return c.json(body);
  });

  return app;
}
