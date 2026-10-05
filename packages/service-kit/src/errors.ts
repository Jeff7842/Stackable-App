import { ZodError } from "zod";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErrorEnvelope } from "@stackable/contracts";

type Details = Record<string, unknown>;

/** An expected failure; its message is safe to show the caller. */
export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;
  readonly details: Details;

  constructor(status: ContentfulStatusCode, code: string, message: string, details: Details = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  validation: (message = "Request validation failed", details: Details = {}) =>
    new AppError(400, "REQUEST_VALIDATION_FAILED", message, details),
  unauthorized: (message = "Authentication required") => new AppError(401, "AUTH_UNAUTHORIZED", message),
  forbidden: (message = "You do not have access to this resource") => new AppError(403, "AUTH_FORBIDDEN", message),
  notFound: (message = "Resource not found") => new AppError(404, "RESOURCE_NOT_FOUND", message),
  conflict: (message = "Resource state conflict", details: Details = {}) =>
    new AppError(409, "RESOURCE_CONFLICT", message, details),
  rateLimited: (message = "Too many requests") => new AppError(429, "RATE_LIMIT_EXCEEDED", message),
  upstream: (message = "A dependency failed") => new AppError(502, "UPSTREAM_FAILED", message),
  unavailable: (message = "Service temporarily unavailable") => new AppError(503, "SERVICE_UNAVAILABLE", message),
  internal: () => new AppError(500, "INTERNAL_ERROR", "Something went wrong"),
};

/** Maps any thrown value to a status and envelope; unknown errors become a generic 500. */
export function toErrorResponse(err: unknown, requestId: string): { status: ContentfulStatusCode; body: ErrorEnvelope } {
  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = errors.validation("Request validation failed", {
      fields: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  } else if (err instanceof HTTPException && err.status === 400) {
    appError = errors.validation("Malformed request");
  } else {
    appError = errors.internal();
  }
  return {
    status: appError.status,
    body: { error: appError.message, code: appError.code, details: appError.details, requestId },
  };
}
