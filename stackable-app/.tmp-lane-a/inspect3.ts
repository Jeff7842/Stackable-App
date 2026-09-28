import { Client } from "pg";
process.loadEnvFile(".env.local");
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r1 = await c.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1");
  console.log(r1.rows.map((x) => x.table_name).join(", "));
  const r2 = await c.query("select split_part(split_part(logo,'://',2),'/',1) host, substring(logo from '^[a-z]+') scheme, count(*) from schools where logo is not null group by 1,2");
  console.log(r2.rows.map((x) => JSON.stringify(x)).join("\n"));
  const r3 = await c.query("select count(*) filter (where role='super-admin') sa, (select count(*) from audit_logs) audits from users");
  console.log(JSON.stringify(r3.rows[0]));
  await c.end();
}
main().catch((e) => { console.error("ERR", e instanceof Error ? e.message : String(e)); process.exit(1); });
