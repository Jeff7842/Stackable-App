// Run: pnpm exec tsx lib/auth/otp.check.ts   (throws on the first failed assertion)
import assert from "node:assert/strict";

async function main() {
  process.env.OTP_HASH_SECRET = "test-secret-only-for-this-check";
  const { hashCode, safeEqual, signChallenge, readChallenge } = await import("./otp");
  const { PASSWORD_RULES, passwordScore, resetPasswordSchema } = await import("../validation/auth");

  // Codes are keyed, deterministic, and bound to purpose + user.
  const h = hashCode("login", "user-1", "12345");
  assert.equal(h, hashCode("login", "user-1", "12345"));
  assert.notEqual(h, hashCode("login", "user-1", "12346"));
  assert.notEqual(h, hashCode("login", "user-2", "12345"));
  assert.notEqual(h, hashCode("reset", "user-1", "12345"));
  assert.ok(!h.includes("12345"));
  assert.ok(safeEqual(h, h) && !safeEqual(h, h.slice(1)));

  // The challenge cookie: genuine works, tampered/expired/garbage do not.
  const token = signChallenge("otp-row-9");
  assert.equal(readChallenge(token), "otp-row-9");
  const [payload, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ id: "someone-else", exp: Date.now() + 1e6 })).toString("base64url");
  assert.equal(readChallenge(`${forged}.${sig}`), null);
  assert.equal(readChallenge(`${payload}.${"0".repeat(sig.length)}`), null);
  assert.equal(readChallenge(signChallenge("x", -1000)), null); // already expired
  assert.equal(readChallenge("nonsense"), null);
  assert.equal(readChallenge(undefined), null);

  // Password rules: same source of truth for the page and the API.
  assert.equal(PASSWORD_RULES.length, 5);
  assert.equal(passwordScore(""), 0);
  assert.equal(passwordScore("Abcdef1!"), 5);
  const good = { token: "t".repeat(40), newPassword: "Abcdef1!", confirmPassword: "Abcdef1!" };
  assert.ok(resetPasswordSchema.safeParse(good).success);
  assert.ok(!resetPasswordSchema.safeParse({ ...good, newPassword: "abcdef1!", confirmPassword: "abcdef1!" }).success); // no capital
  assert.ok(!resetPasswordSchema.safeParse({ ...good, confirmPassword: "Abcdef1?" }).success); // mismatch

  console.log("otp.check: all assertions passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
