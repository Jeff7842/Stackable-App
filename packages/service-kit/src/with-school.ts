import type { Pool, PoolClient } from "pg";

/** Runs fn in a transaction scoped to one school so row-level security applies to every query in it. */
export async function withSchool<T>(pool: Pool, schoolId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // is_local=true drops the setting at commit, so a pooled connection never leaks a tenant.
    await client.query("select set_config('app.school_id', $1, true)", [schoolId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
