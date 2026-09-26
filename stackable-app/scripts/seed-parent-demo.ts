/* =============================================================================
 * Demo seed: one parent linked to two existing students (Neon/staging only).
 * Lets us see the Parent dashboard with real grades/attendance.
 * Idempotent: re-running won't create duplicates. Run: pnpm tsx scripts/seed-parent-demo.ts
 * ===========================================================================*/

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

(process as NodeJS.Process & { loadEnvFile?: (p: string) => void }).loadEnvFile?.(
  ".env.local",
);

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO_EMAIL = "parent.demo@stackable.test";

async function main() {
  // Pick two students (in the same school) that actually have grade reports.
  const reports = await db.grading_reports.findMany({
    select: { student_id: true },
    distinct: ["student_id"],
    take: 50,
  });
  const candidateIds = reports.map((r) => r.student_id);
  const students = await db.students.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true, school_id: true, school_name: true, first_name: true, last_name: true },
    take: 50,
  });
  if (students.length < 1) throw new Error("No students with grades to link.");

  // Group by school, take the school with the most candidates.
  const bySchool = new Map<string, typeof students>();
  for (const s of students) {
    const arr = bySchool.get(s.school_id) ?? [];
    arr.push(s);
    bySchool.set(s.school_id, arr);
  }
  const [schoolId, schoolStudents] = [...bySchool.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )[0];
  const chosen = schoolStudents.slice(0, 2);
  const school = await db.schools.findFirst({
    where: { id: schoolId },
    select: { code: true, name: true },
  });

  // Create (or reuse) the demo parent login user.
  let user = await db.users.findFirst({ where: { email: DEMO_EMAIL } });
  if (!user) {
    user = await db.users.create({
      data: {
        school_id: schoolId,
        school_code: school?.code ?? "",
        email: DEMO_EMAIL,
        role: "parent",
        status: "active",
        first_name: "Demo",
        last_name: "Parent",
        must_change_password: false,
      },
    });
  }

  // Create (or reuse) the parent profile.
  let parent = await db.parent.findUnique({ where: { user_id: user.id } });
  if (!parent) {
    parent = await db.parent.create({
      data: {
        user_id: user.id,
        school_id: schoolId,
        school_name: school?.name ?? chosen[0].school_name,
        phone: BigInt("254700000001"),
        status: "active",
      },
    });
  }

  // Link the children (idempotent on the unique [student_id, parent_id]).
  for (const [i, s] of chosen.entries()) {
    const exists = await db.student_parents.findFirst({
      where: { parent_id: parent.id, student_id: s.id },
    });
    if (!exists) {
      await db.student_parents.create({
        data: {
          parent_id: parent.id,
          student_id: s.id,
          school_id: schoolId,
          school_name: school?.name ?? s.school_name,
          relationship: i === 0 ? "mother" : "guardian",
          description: "Demo guardian link",
          is_primary: i === 0,
          primary_role: i === 0 ? "financial" : null,
        },
      });
    }
  }

  console.log("Demo parent ready:");
  console.log("  user_id:", user.id, "(email:", DEMO_EMAIL + ")");
  console.log("  school:", school?.name);
  console.log("  children:", chosen.map((c) => `${c.first_name} ${c.last_name}`).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
