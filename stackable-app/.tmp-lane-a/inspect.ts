// throwaway read-only inspection: prints ONLY schema metadata
import { Client } from "pg";
process.loadEnvFile(".env.local");
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const q = async (label: string, sql: string, params: unknown[] = []) => {
    const r = await c.query(sql, params);
    console.log("== " + label);
    console.log(r.rows.map((x) => JSON.stringify(x)).join("\n"));
  };
  await q("views/tables named school_usage%", "select table_schema, table_name, table_type from information_schema.tables where table_name like 'school_usage%'");
  await q("schools columns", "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='schools' order by ordinal_position");
  await q("school_profiles columns", "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='school_profiles' order by ordinal_position");
  await q("school_security_codes columns", "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='school_security_codes' order by ordinal_position");
  await q("audit_logs columns", "select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name='audit_logs' order by ordinal_position");
  await q("counts", "select (select count(*) from schools) schools, (select count(*) from school_profiles) profiles, (select count(*) from school_security_codes) codes, (select count(*) from users) users");
  await q("students/teachers/parent/users role distribution", "select role, count(*) from users group by role order by role");
  await q("triggers on schools/users", "select event_object_table, trigger_name from information_schema.triggers where event_object_table in ('schools','users','school_profiles')");
  await q("schools status/subscription values", "select status, subscription_status, subscription_package, count(*) from schools group by 1,2,3");
  await q("students columns school", "select column_name, data_type from information_schema.columns where table_schema='public' and table_name in ('students','teachers','parent') and column_name in ('school_id','school_name','status','user_id') order by table_name, column_name");
  await c.end();
}
main().catch((e) => { console.error("ERR", e instanceof Error ? e.message : String(e)); process.exit(1); });
