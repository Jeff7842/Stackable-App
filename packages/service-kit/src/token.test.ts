import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { signServiceToken, verifyServiceToken } from "./token";

const SECRET = "test-secret-test-secret-test-secret-1234";
const base = { audience: "identity", sub: "user-1", schoolId: "school-1" };

beforeEach(() => {
  process.env.SERVICE_TOKEN_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.SERVICE_TOKEN_SECRET;
});

describe("service token", () => {
  it("accepts a valid token and returns its claims", async () => {
    const claims = await verifyServiceToken(await signServiceToken({ ...base, role: "teacher" }), "identity");
    expect(claims).toMatchObject({ sub: "user-1", schoolId: "school-1", aud: "identity", role: "teacher" });
  });

  it("rejects an expired token", async () => {
    const token = await signServiceToken({ ...base, ttlSeconds: -10 });
    await expect(verifyServiceToken(token, "identity")).rejects.toMatchObject({ status: 401 });
  });

  it("rejects the wrong audience", async () => {
    const token = await signServiceToken({ ...base, audience: "payments" });
    await expect(verifyServiceToken(token, "identity")).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a token signed with another secret", async () => {
    const forged = await new SignJWT({ schoolId: "school-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("stackable-gateway")
      .setAudience("identity")
      .setSubject("user-1")
      .setExpirationTime("1m")
      .sign(new TextEncoder().encode("another-secret-another-secret-12345"));
    await expect(verifyServiceToken(forged, "identity")).rejects.toMatchObject({ status: 401 });
  });

  it("throws when the secret is unset, for signing and verifying", async () => {
    const token = await signServiceToken(base);
    delete process.env.SERVICE_TOKEN_SECRET;
    await expect(signServiceToken(base)).rejects.toThrow("SERVICE_TOKEN_SECRET");
    await expect(verifyServiceToken(token, "identity")).rejects.toThrow("SERVICE_TOKEN_SECRET");
  });
});
