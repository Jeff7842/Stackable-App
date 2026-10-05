// =============================================================================
// API errors — one clean way to fail.
// -----------------------------------------------------------------------------
// Instead of every route inventing its own error shape, throw an ApiError and
// let toErrorResponse() turn it into a proper JSON HTTP response. This keeps all
// our error messages consistent.
// =============================================================================

import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
    status: number,
    message: string,
    options?: { code?: string; details?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
  }
}

// Small helpers so routes read nicely: throw unauthorized("...") etc.
export const unauthorized = (m = "You must sign in.") => new ApiError(401, m, { code: "UNAUTHORIZED" });
export const forbidden = (m = "You do not have access to this.") => new ApiError(403, m, { code: "FORBIDDEN" });
export const notFound = (m = "Not found.") => new ApiError(404, m, { code: "NOT_FOUND" });
export const badRequest = (m = "Invalid request.", details?: unknown) => new ApiError(400, m, { code: "BAD_REQUEST", details });
export const tooManyRequests = (m = "Too many requests. Please slow down.") => new ApiError(429, m, { code: "RATE_LIMITED" });
export const serviceUnavailable = (m = "A required service is unavailable. Try again shortly.") => new ApiError(503, m, { code: "UNAVAILABLE" });

/** Convert any thrown value into a safe JSON response. Every error carries a requestId. */
export function toErrorResponse(err: unknown, requestId: string = crypto.randomUUID()): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, code: err.code, details: err.details ?? null, requestId },
      { status: err.status, headers: { "x-request-id": requestId } },
    );
  }

  // Unknown/unexpected error: don't leak internals to the client.
  console.error(`[api] Unhandled error (${requestId}):`, err);
  return NextResponse.json(
    { error: "Something went wrong.", code: "INTERNAL", requestId },
    { status: 500, headers: { "x-request-id": requestId } },
  );
}
