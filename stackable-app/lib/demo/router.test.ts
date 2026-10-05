import { describe, expect, it } from "vitest";
import { handleDemoRequest, route } from "./router";

const call = (method: string, path: string, body?: unknown) =>
  handleDemoRequest(method, new URL(path, "http://x"), body, "parent", {});

describe("demo router", () => {
  it("matches path params and returns 200 by default", () => {
    route("GET", "/api/test/:id", ({ params }) => ({ id: params.id }));
    expect(call("GET", "/api/test/a%20b")).toEqual({ status: 200, body: { id: "a b" } });
  });

  it("passes through an explicit status", () => {
    route("POST", "/api/test-fail", () => ({ status: 400, body: { error: "no" } }));
    expect(call("POST", "/api/test-fail").status).toBe(400);
  });

  it("answers unknown paths with a clear 404", () => {
    const res = call("GET", "/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "DEMO_UNAVAILABLE" });
  });
});
