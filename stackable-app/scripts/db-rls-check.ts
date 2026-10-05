// Proves the students RLS policy: run with `pnpm exec tsx scripts/db-rls-check.ts`.
// Connects as the owner, creates a temporary NOBYPASSRLS role, and checks isolation inside a rolled-back transaction.
import { Client } from "pg";

try {
  (process as NodeJS.Process & { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  // env may already be set
}

const ROLE = "rls_check_tmp";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

async function countAs(db: Client, schoolId: string | null): Promise<number> {
  await db.query("SAVEPOINT s");
  await db.query(`SET LOCAL ROLE ${ROLE}`);
  await db.query("SELECT set_config('app.school_id', $1, true)", [schoolId ?? ""]);
  const r = await db.query("SELECT count(*)::int AS n FROM students");
  await db.query("RESET ROLE");
  await db.query("RELEASE SAVEPOINT s");
  return r.rows[0].n as number;
}

async function main(): Promise<void> {
  const db = new Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query(`CREATE ROLE ${ROLE} NOLOGIN NOBYPASSRLS`);
    await db.query(`GRANT USAGE ON SCHEMA public, app TO ${ROLE}`);
    await db.query(`GRANT EXECUTE ON FUNCTION app.current_school_id() TO ${ROLE}`);
    await db.query(`GRANT SELECT ON students TO ${ROLE}`);

    const { rows } = await db.query(
      "SELECT school_id, count(*)::int AS n FROM students GROUP BY school_id ORDER BY n DESC LIMIT 2",
    );
    assert(rows.length === 2, "at least two schools have students");
    const [a, b] = rows as { school_id: string; n: number }[];

    assert((await countAs(db, a.school_id)) === a.n, `school A sees only its ${a.n} students`);
    assert((await countAs(db, b.school_id)) === b.n, `school B sees only its ${b.n} students`);
    assert((await countAs(db, null)) === 0, "no app.school_id setting sees zero rows");
    console.log("RLS check passed (transaction rolled back, temp role not kept).");
  } finally {
    await db.query("ROLLBACK").catch(() => undefined);
    await db.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
