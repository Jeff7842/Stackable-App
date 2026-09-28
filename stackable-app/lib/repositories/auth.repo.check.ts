// READ-ONLY smoke check of the auth repository against the real database (DATABASE_URL).
// Run: pnpm exec tsx lib/repositories/auth.repo.check.ts
// It writes nothing and prints counts only (no emails, hashes or ids).
import assert from "node:assert/strict";

(process as NodeJS.Process & { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");

async function main() {
  const repo = await import("./auth.repo");
  const { prisma } = await import("../db/prisma");
  const NONE = "00000000-0000-4000-8000-000000000000";

  // A real user, only to prove the case-insensitive email lookup works.
  const sample = await prisma.users.findFirst({ where: { email: { not: null } }, select: { email: true, id: true } });
  assert.ok(sample?.email, "no user with an email in this database");
  const upper = await repo.findUsersByEmail(sample.email.toUpperCase());
  assert.ok(upper.length >= 1 && upper.some((u) => u.id === sample.id), "case-insensitive email lookup failed");
  assert.equal((await repo.findUsersByEmail("nobody@example.invalid")).length, 0);

  const byId = await repo.findUserById(sample.id);
  assert.equal(byId?.id, sample.id);
  assert.equal(await repo.findUserById(NONE), null);

  // Unknown session / otp / reset lookups must return "nothing", never throw.
  assert.equal(await repo.findLiveSession("not-a-real-token-hash", new Date()), null);
  assert.equal(await repo.getOtp(NONE), null);
  assert.equal(await repo.countLoginOtpsSince(NONE, new Date(0)), 0);
  assert.equal(await repo.findLiveReset(NONE, new Date()), null);
  assert.deepEqual(await repo.listResetTimesSince(NONE, new Date(0)), []);
  assert.equal(await repo.claimResetToken("not-a-real-token-hash", new Date()), null);
  assert.equal((await repo.findActiveUsersByEmail("nobody@example.invalid")).length, 0);

  // No permission row means "allowed" (only an explicit can_access=false denies).
  assert.equal(await repo.isPageAllowed(NONE, "teachers"), true);

  // Compare-and-set helpers on rows that do not exist must report "did not win".
  assert.equal(await repo.reserveOtpAttempt(NONE, 0), false);
  assert.equal(await repo.consumeOtp(NONE), false);
  assert.equal(await repo.reserveResetAttempt(NONE, 0), false);
  assert.equal(await repo.issueResetToken(NONE, "x", new Date()), false);

  await prisma.$disconnect();
  console.log("auth.repo.check: all read-only assertions passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
