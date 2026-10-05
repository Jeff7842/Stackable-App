import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";
import { rateLimitOrSkip } from "./ratelimit";

// No Redis env is set in tests, so getRedis() throws as it would in an outage.
describe("rateLimitOrSkip", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("skips when Redis is down outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    await expect(rateLimitOrSkip("auth", "x")).resolves.toBeUndefined();
  });

  it("fails closed with 503 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    const err = await rateLimitOrSkip("auth", "x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(503);
  });
});
