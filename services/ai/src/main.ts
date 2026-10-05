import { serve } from "@hono/node-server";
import pg from "pg";
import { buildApp } from "./app";
import { FakeProvider } from "./fakeProvider";
import { GroqProvider } from "./groqProvider";
import { PgStore } from "./pgStore";
import { MemoryStore } from "./store";

const DEFAULT_PORT = 4003;
const databaseUrl = process.env.DATABASE_URL;

// Only dev may run without a database; production must fail at boot, not at first request.
if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl }) : undefined;
const store = pool ? new PgStore(pool) : new MemoryStore();
// Groq is used once a key exists; until then the fake provider keeps the UI working.
const groq = new GroqProvider({ apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL });
const provider = process.env.AI_PROVIDER === "fake" || !groq.enabled ? new FakeProvider() : groq;

const app = buildApp({ store, provider, pool, version: process.env.npm_package_version ?? "0.0.0" });
const server = serve({ fetch: app.fetch, port: Number(process.env.PORT ?? DEFAULT_PORT) });

process.on("SIGTERM", () => {
  server.close(() => void pool?.end());
});
