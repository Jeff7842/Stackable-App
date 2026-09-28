import { Client } from "pg";
process.loadEnvFile(".env.local");
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r1 = await c.query("select no::text no, school_id::text school_id, code_change_count, length(phone_1::text) phone_len, (email is null) email_null, (logo is null) logo_null, status, subscription_status from schools order by no");
  console.log(r1.rows.map((x) => JSON.stringify(x)).join("\n"));
  const r2 = await c.query("select conname, contype from pg_constraint where conrelid in ('schools'::regclass,'users'::regclass,'school_profiles'::regclass) and contype in ('c','u','p')");
  console.log(r2.rows.map((x) => JSON.stringify(x)).join("\n"));
  const r3 = await c.query("select pg_get_constraintdef(oid) d from pg_constraint where conrelid='schools'::regclass and contype='c'");
  console.log(r3.rows.map((x) => x.d).join("\n"));
  const r4 = await c.query("select pg_get_constraintdef(oid) d from pg_constraint where conrelid='users'::regclass and contype='c'");
  console.log(r4.rows.map((x) => x.d).join("\n"));
  await c.end();
}
main().catch((e) => { console.error("ERR", e instanceof Error ? e.message : String(e)); process.exit(1); });
