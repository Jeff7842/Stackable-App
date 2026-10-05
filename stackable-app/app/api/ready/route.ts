// GET /api/ready -> readiness: 503 when the database is down, "degraded" when only an optional dependency is.
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/api/redis";
import { pingDatabase } from "@/lib/repositories/dev-console.repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Check = { name: string; ok: boolean; required: boolean; latencyMs: number | null };

async function probe(name: string, required: boolean, run: () => Promise<unknown>): Promise<Check> {
  const startedAt = performance.now();
  try {
    // 5 s: a sleeping serverless database can take seconds on the first query.
    await Promise.race([run(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000))]);
    return { name, ok: true, required, latencyMs: Math.round(performance.now() - startedAt) };
  } catch {
    return { name, ok: false, required, latencyMs: null };
  }
}

export async function GET() {
  const redisConfigured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const checks = await Promise.all([
    probe("database", true, pingDatabase),
    ...(redisConfigured ? [probe("redis", false, () => getRedis().ping())] : []),
  ]);
  const requiredDown = checks.some((c) => c.required && !c.ok);
  const status = requiredDown ? "unavailable" : checks.some((c) => !c.ok) ? "degraded" : "ready";
  return NextResponse.json(
    { status, checks: checks.map(({ name, ok, latencyMs }) => ({ name, ok, latencyMs })) },
    { status: requiredDown ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
