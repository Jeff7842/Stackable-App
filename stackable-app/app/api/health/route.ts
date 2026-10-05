// GET /api/health -> liveness: the process is up. Public, no dependencies checked.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const startedAt = Date.now();

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      name: "gateway",
      version: process.env.BUILD_VERSION ?? "dev",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
