import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { signServiceToken } from "@stackable/service-kit";
import { buildApp } from "./app";

beforeEach(() => {
  process.env.SERVICE_TOKEN_SECRET = "test-secret-test-secret-test-secret-1234";
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  delete process.env.SERVICE_TOKEN_SECRET;
  vi.restoreAllMocks();
});

const okPool = { query: async () => ({ rows: [] }) } as unknown as Pool;
const badPool = { query: async () => Promise.reject(new Error("down")) } as unknown as Pool;

describe("GET /v1/me", () => {
  it("returns the actor from a valid token", async () => {
    const token = await signServiceToken({ audience: "identity", sub: "u1", schoolId: "s1", role: "teacher" });
    const res = await buildApp(okPool, "1").request("/v1/me", { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "u1", schoolId: "s1", role: "teacher" });
  });

  it("rejects a missing token with the envelope", async () => {
    const res = await buildApp(okPool, "1").request("/v1/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "AUTH_UNAUTHORIZED" });
  });

  it("rejects a token issued for another service", async () => {
    const token = await signServiceToken({ audience: "payments", sub: "u1", schoolId: "s1" });
    const res = await buildApp(okPool, "1").request("/v1/me", { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });
});

describe("probes", () => {
  it("/ready is 200 with a healthy database", async () => {
    expect((await buildApp(okPool, "1").request("/ready")).status).toBe(200);
  });

  it("/ready is 503 when the database is down", async () => {
    expect((await buildApp(badPool, "1").request("/ready")).status).toBe(503);
  });

  it("/ready is degraded, not 503, when no database is configured in dev", async () => {
    const res = await buildApp(undefined, "1").request("/ready");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "degraded" });
  });
});
