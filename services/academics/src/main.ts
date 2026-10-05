import { serve } from "@hono/node-server";
import pg from "pg";
import { buildApp } from "./app";
import { autoSubmitDue } from "./features/cats/deadline-worker";
import { createMemoryStore } from "./store/memory";
import { createPgStore } from "./store/pg";

const DEFAULT_PORT = 4002;
const DEADLINE_SWEEP_MS = 15_000; // an expired attempt waits at most this long to be auto-submitted
const databaseUrl = process.env.DATABASE_URL;

// Only dev may run without a database; production must fail at boot, not at first request.
if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl }) : undefined;
const store = pool ? createPgStore(pool) : createMemoryStore();
const app = buildApp(store, pool, process.env.npm_package_version ?? "0.0.0");
const server = serve({ fetch: app.fetch, port: Number(process.env.PORT ?? DEFAULT_PORT) });

// Run exactly one academics instance with this sweep enabled (see README).
const sweep = setInterval(() => {
  autoSubmitDue(store, new Date()).catch((err) => console.error(JSON.stringify({ level: "error", msg: "deadline sweep failed", err: String(err) })));
}, DEADLINE_SWEEP_MS);

process.on("SIGTERM", () => {
  clearInterval(sweep);
  server.close(() => void pool?.end());
});
