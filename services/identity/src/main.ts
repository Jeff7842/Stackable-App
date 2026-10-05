import { serve } from "@hono/node-server";
import pg from "pg";
import { buildApp } from "./app";

const DEFAULT_PORT = 4001;
const databaseUrl = process.env.DATABASE_URL;

// Only dev may run without a database; production must fail at boot, not at first request.
if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl }) : undefined;
const app = buildApp(pool, process.env.npm_package_version ?? "0.0.0");
const server = serve({ fetch: app.fetch, port: Number(process.env.PORT ?? DEFAULT_PORT) });

process.on("SIGTERM", () => {
  server.close(() => void pool?.end());
});
