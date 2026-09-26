/* =============================================================================
 * One-off data copy: Supabase  ->  Neon (the new Prisma database).
 * -----------------------------------------------------------------------------
 * Reads every table from the old Supabase database and writes it into the new
 * Neon database, in an order that respects foreign keys (parents before
 * children). Safe to re-run: it skips rows that already exist.
 *
 * Run with:  pnpm db:transfer
 * ===========================================================================*/

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

// Load secrets from .env.local (this script is run directly, not by Next.js).
(process as NodeJS.Process & { loadEnvFile?: (p: string) => void }).loadEnvFile?.(
  ".env.local",
);

const SOURCE_URL = process.env.SUPABASE_DB_URL;
const TARGET_URL = process.env.DATABASE_URL;

if (!SOURCE_URL || !TARGET_URL) {
  throw new Error("Set SUPABASE_DB_URL and DATABASE_URL in .env.local first.");
}

const source = new PrismaClient({
  adapter: new PrismaPg({ connectionString: SOURCE_URL }),
});
const target = new PrismaClient({
  adapter: new PrismaPg({ connectionString: TARGET_URL }),
});

// Tables in foreign-key-safe order (parents first).
const TABLES = [
  "schools",
  "subjects",
  "users",
  "school_profiles",
  "teachers",
  "school_security_codes",
  "classes",
  "school_subjects",
  "school_subject_classes",
  "school_subject_teacher_assignments",
  "students",
  "parent",
  "student_parents",
  "student_subjects",
  "teacher_subjects",
  "teacher_timetables",
  "teacher_student_assignments",
  "user_otps",
  "user_page_permissions",
  "user_profiles",
  "user_sessions",
  "class_attendance",
  "class_subject_performance",
  "grading_reports",
  "attendance",
] as const;

const BATCH = 500;

async function copyTable(name: string): Promise<{ read: number; have: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const src = (source as any)[name];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dst = (target as any)[name];

  const rows: unknown[] = await src.findMany();
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await dst.createMany({ data: chunk, skipDuplicates: true });
  }
  const have: number = await dst.count();
  return { read: rows.length, have };
}

async function resetSequences() {
  // After inserting explicit ids, move the auto-increment counters past the max
  // so new inserts don't collide.
  const stmts = [
    `SELECT setval(pg_get_serial_sequence('subjects','id'), GREATEST(COALESCE((SELECT MAX(id) FROM subjects), 1), 1))`,
    `SELECT setval(pg_get_serial_sequence('schools','no'), GREATEST(COALESCE((SELECT MAX(no) FROM schools), 1), 1))`,
  ];
  for (const s of stmts) {
    try {
      await target.$executeRawUnsafe(s);
    } catch (e) {
      console.warn("  (sequence reset skipped:", (e as Error).message, ")");
    }
  }
}

async function main() {
  console.log("Copying Supabase -> Neon\n");
  let ok = true;
  const summary: Array<[string, number, number]> = [];

  for (const name of TABLES) {
    try {
      const { read, have } = await copyTable(name);
      const status = read === have ? "OK " : "!! ";
      if (read !== have) ok = false;
      console.log(`${status}${name.padEnd(38)} source=${read}  target=${have}`);
      summary.push([name, read, have]);
    } catch (e) {
      ok = false;
      console.error(`ERR ${name}: ${(e as Error).message}`);
    }
  }

  console.log("\nResetting sequences...");
  await resetSequences();

  console.log("\n=== Summary ===");
  const totalSrc = summary.reduce((a, [, r]) => a + r, 0);
  const totalDst = summary.reduce((a, [, , h]) => a + h, 0);
  console.log(`Total rows: source=${totalSrc}  target=${totalDst}`);
  console.log(ok ? "All tables match. ✅" : "Some tables differ — review above. ⚠️");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
