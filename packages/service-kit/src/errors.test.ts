import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ErrorEnvelopeSchema } from "@stackable/contracts";
import { errors, toErrorResponse } from "./errors";

describe("toErrorResponse", () => {
  const cases = [
    ["validation", errors.validation(), 400, "REQUEST_VALIDATION_FAILED"],
    ["unauthorized", errors.unauthorized(), 401, "AUTH_UNAUTHORIZED"],
    ["forbidden", errors.forbidden(), 403, "AUTH_FORBIDDEN"],
    ["notFound", errors.notFound(), 404, "RESOURCE_NOT_FOUND"],
    ["conflict", errors.conflict(), 409, "RESOURCE_CONFLICT"],
    ["rateLimited", errors.rateLimited(), 429, "RATE_LIMIT_EXCEEDED"],
    ["upstream", errors.upstream(), 502, "UPSTREAM_FAILED"],
    ["unavailable", errors.unavailable(), 503, "SERVICE_UNAVAILABLE"],
    ["internal", errors.internal(), 500, "INTERNAL_ERROR"],
  ] as const;

  it.each(cases)("maps %s to its status and code", (_name, err, status, code) => {
    const res = toErrorResponse(err, "req-1");
    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.requestId).toBe("req-1");
  });

  it("turns unknown errors into a generic 500 without leaking the message", () => {
    const res = toErrorResponse(new Error("password=hunter2 in connection string"), "req-2");
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
  });

  it("turns a ZodError into a 400 listing the failed fields", () => {
    const parsed = z.object({ age: z.number() }).safeParse({ age: "x" });
    const res = toErrorResponse(parsed.error, "req-3");
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual({ fields: [{ path: "age", message: expect.any(String) }] });
  });
});
