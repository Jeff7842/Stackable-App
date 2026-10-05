// A tiny in-browser API: handlers answer /api/* calls while demo mode is on.
import type { Role } from "@/lib/validation/shared";
import type { DemoDb } from "./store";

export type DemoRequest = {
  role: Role;
  db: DemoDb;
  url: URL;
  params: Record<string, string>;
  body: unknown;
};
/** Return the JSON body, or { status, body } for a non-200 answer. */
export type DemoHandler = (req: DemoRequest) => unknown | { status: number; body: unknown };

type Route = { method: string; pattern: RegExp; keys: string[]; handler: DemoHandler };
const routes: Route[] = [];

/** Register a handler. Path params use ":name", e.g. "/api/students/:id". */
export function route(method: string, path: string, handler: DemoHandler): void {
  const keys: string[] = [];
  const source = path.replace(/:([A-Za-z]+)/g, (_, key: string) => {
    keys.push(key);
    return "([^/]+)";
  });
  routes.push({ method, pattern: new RegExp(`^${source}$`), keys, handler });
}

const isStatusBody = (v: unknown): v is { status: number; body: unknown } =>
  typeof v === "object" && v !== null && "status" in v && "body" in v;

/** Answer a request from the registered handlers; unknown paths get a clear 404. */
export function handleDemoRequest(
  method: string,
  url: URL,
  body: unknown,
  role: Role,
  db: DemoDb,
): { status: number; body: unknown } {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.pattern.exec(url.pathname);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const out = r.handler({ role, db, url, params, body });
    return isStatusBody(out) ? out : { status: 200, body: out };
  }
  return { status: 404, body: { error: "This action is not available in the demo.", code: "DEMO_UNAVAILABLE" } };
}
