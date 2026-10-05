import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createService } from "./service";
import { errors } from "./errors";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("request id", () => {
  it("echoes an incoming x-request-id and puts it in error bodies", async () => {
    const app = createService({ name: "t", version: "1" });
    app.get("/boom", () => {
      throw errors.conflict("nope");
    });
    const res = await app.request("/boom", { headers: { "x-request-id": "abc-123" } });
    expect(res.headers.get("x-request-id")).toBe("abc-123");
    expect(await res.json()).toMatchObject({ code: "RESOURCE_CONFLICT", requestId: "abc-123" });
  });

  it("generates an id when missing or malformed", async () => {
    const app = createService({ name: "t", version: "1" });
    const missing = await app.request("/health");
    const bad = await app.request("/health", { headers: { "x-request-id": "bad id with spaces" } });
    expect(missing.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(bad.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("error handling", () => {
  it("hides internals of unexpected errors and returns the envelope", async () => {
    const app = createService({ name: "t", version: "1" });
    app.get("/crash", () => {
      throw new Error("db password leaked");
    });
    const res = await app.request("/crash");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("leaked");
  });

  it("returns the envelope for unknown routes", async () => {
    const res = await createService({ name: "t", version: "1" }).request("/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});

describe("/health", () => {
  it("is always 200 with name, version and uptime", async () => {
    const res = await createService({ name: "svc", version: "9.9.9" }).request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", name: "svc", version: "9.9.9", uptimeSeconds: expect.any(Number) });
  });
});

describe("/ready", () => {
  const pass = async () => undefined;
  const fail = async () => {
    throw new Error("down");
  };

  it("is ready when all checks pass", async () => {
    const app = createService({ name: "t", version: "1", checks: [{ name: "db", run: pass }] });
    const res = await app.request("/ready");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ready", checks: [{ name: "db", ok: true }] });
  });

  it("is degraded (200) when only an optional check fails", async () => {
    const app = createService({
      name: "t",
      version: "1",
      checks: [{ name: "db", run: pass }, { name: "resend", run: fail, required: false }],
    });
    const res = await app.request("/ready");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "degraded" });
  });

  it("is 503 when a required check fails", async () => {
    const app = createService({ name: "t", version: "1", checks: [{ name: "db", run: fail }] });
    const res = await app.request("/ready");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "not_ready", checks: [{ name: "db", ok: false }] });
  });

  it("fails a check that hangs past the timeout", async () => {
    vi.useFakeTimers();
    const hang = () => new Promise<void>(() => undefined);
    const app = createService({ name: "t", version: "1", checks: [{ name: "slow", run: hang }] });
    const pending = app.request("/ready");
    await vi.advanceTimersByTimeAsync(2100);
    const res = await pending;
    expect(res.status).toBe(503);
  });
});
