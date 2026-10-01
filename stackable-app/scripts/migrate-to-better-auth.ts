/* =============================================================================
 * One-off backfill: legacy `users` (+ password_hash)  ->  Better Auth's
 * ba_user / ba_account tables, on the SAME Neon database.
 * -----------------------------------------------------------------------------
 * Reuses each legacy user's own id as the new ba_user.id, so every other
 * table that scopes by userId from the session (teacher.repo, student.repo,
 * user_page_permissions, audit_logs, ...) keeps working unchanged.
 *
 * The existing bcrypt password_hash is copied as-is into ba_account.password;
 * lib/auth/auth.ts's password.verify() already detects "$2"-prefixed hashes
 * and compares with bcryptjs, then Better Auth re-hashes with scrypt on the
 * user's next successful login.
 *
 * Safe to re-run: skips users that already have a ba_user row.
 *
 * Run with:  pnpm tsx scripts/migrate-to-better-auth.ts
 * ===========================================================================*/

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { randomUUID } from "node:crypto";

(process as NodeJS.Process & { loadEnvFile?: (p: string) => void }).loadEnvFile?.(
  ".env.local",
);

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("Set DATABASE_URL in .env.local first.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DB_URL }),
});

async function main() {
  console.log("Backfilling legacy users -> ba_user/ba_account\n");

  const legacyUsers = await prisma.users.findMany({
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      school_id: true,
      school_code: true,
      role: true,
      status: true,
      password_hash: true,
      must_change_password: true,
    },
  });

  const existingIds = new Set(
    (await prisma.ba_user.findMany({ select: { id: true } })).map((u) => u.id),
  );

  let created = 0;
  let skippedNoEmail = 0;
  let skippedNoPassword = 0;
  let alreadyDone = 0;

  for (const u of legacyUsers) {
    if (existingIds.has(u.id)) {
      alreadyDone++;
      continue;
    }
    if (!u.email) {
      skippedNoEmail++;
      continue;
    }
    if (!u.password_hash) {
      // Nothing to log in with yet (e.g. must_change_password before first set) — skip for now.
      skippedNoPassword++;
      continue;
    }

    const name = `${u.first_name} ${u.last_name}`.trim() || u.email;

    await prisma.$transaction([
      prisma.ba_user.create({
        data: {
          id: u.id,
          name,
          email: u.email,
          emailVerified: true,
          schoolId: u.school_id,
          role: u.role,
          schoolCode: u.school_code,
          status: u.status,
          mustChangePassword: u.must_change_password,
          // Replicates the legacy flow's mandatory-OTP-after-password behavior.
          twoFactorEnabled: true,
        },
      }),
      prisma.ba_account.create({
        data: {
          id: randomUUID(),
          accountId: u.id,
          providerId: "credential",
          userId: u.id,
          password: u.password_hash,
        },
      }),
    ]);
    created++;
  }

  console.log(`Created:            ${created}`);
  console.log(`Already migrated:   ${alreadyDone}`);
  console.log(`Skipped (no email): ${skippedNoEmail}`);
  console.log(`Skipped (no pwd):   ${skippedNoPassword}`);
  console.log(`Total legacy users: ${legacyUsers.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
