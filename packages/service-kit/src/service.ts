import { Hono, type MiddlewareHandler } from "hono";
import type { ServiceTokenClaims } from "@stackable/contracts";
import { errors, toErrorResponse } from "./errors";
import { createLogger, type Logger } from "./logger";
import { verifyServiceToken } from "./token";

export const READY_CHECK_TIMEOUT_MS = 2000; // a hung dependency must not hang the probe
const REQUEST_ID_PATTERN = /^[\w.-]{1,128}$/; // reject anything that could forge log lines

export interface ReadyCheck {
  name: string;
  run: () => Promise<unknown>;
  /** Defaults to true; a failing optional check only marks the service degraded. */
  required?: boolean;
}

export interface ServiceOptions {
  name: string;
  version: string;
  checks?: ReadyCheck[];
}

export type AppEnv = {
  Variables: { requestId: string; log: Logger; claims: ServiceTokenClaims };
};

async function runCheck(check: ReadyCheck) {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  let ok = true;
  let failure: unknown;
  try {
    await Promise.race([
      check.run(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("check timed out")), READY_CHECK_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    ok = false;
    failure = err;
  } finally {
    clearTimeout(timer);
  }
  return { name: check.name, ok, latencyMs: Date.now() - started, required: check.required !== false, failure };
}

/** Builds a Hono app with request ids, the error envelope, /health and /ready already wired. */
export function createService({ name, version, checks = [] }: ServiceOptions): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const logger = createLogger(name);
  const startedAt = Date.now();

  const requestId: MiddlewareHandler<AppEnv> = async (c, next) => {
    const incoming = c.req.header("x-request-id");
    const id = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
    const log = logger.child({ requestId: id });
    c.set("requestId", id);
    c.set("log", log);
    c.header("x-request-id", id);
    const began = Date.now();
    await next();
    log.info("request", { method: c.req.method, path: c.req.path, status: c.res.status, durationMs: Date.now() - began });
  };
  app.use("*", requestId);

  app.get("/health", (c) =>
    c.json({ status: "ok", name, version, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) }),
  );

  app.get("/ready", async (c) => {
    const results = await Promise.all(checks.map(runCheck));
    for (const r of results) {
      if (!r.ok) c.var.log.warn("ready check failed", { check: r.name, reason: String(r.failure) });
    }
    const body = results.map(({ name: checkName, ok, latencyMs }) => ({ name: checkName, ok, latencyMs }));
    if (results.some((r) => !r.ok && r.required)) return c.json({ status: "not_ready", checks: body }, 503);
    return c.json({ status: results.some((r) => !r.ok) ? "degraded" : "ready", checks: body });
  });

  app.notFound(() => {
    throw errors.notFound("Route not found");
  });

  app.onError((err, c) => {
    const id = c.var.requestId ?? "unknown";
    const { status, body } = toErrorResponse(err, id);
    if (status === 500) {
      (c.var.log ?? logger).error("unhandled error", { requestId: id, err: String(err), stack: (err as Error).stack });
    }
    return c.json(body, status);
  });

  return app;
}

/** Guards a route: requires a valid Bearer service token for this audience and exposes its claims. */
export function requireServiceToken(audience: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    if (!token) throw errors.unauthorized("Missing service token");
    c.set("claims", await verifyServiceToken(token, audience));
    await next();
  };
}
