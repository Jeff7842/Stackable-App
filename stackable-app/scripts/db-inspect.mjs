// Read-only helper: node scripts/db-inspect.mjs "<sql>"
import pg from "pg";
try { process.loadEnvFile(".env.local"); } catch {}
const c = new pg.Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
await c.connect();
const r = await c.query(process.argv[2]);
console.log(JSON.stringify(r.rows, null, 1));
await c.end();
