// =============================================================================
// Input validation — never trust what the client sends.
// -----------------------------------------------------------------------------
// These helpers take the raw request body and a Zod "shape", and either return
// clean, typed data or throw a 400 ApiError that lists exactly what was wrong.
// =============================================================================

import type { z } from "zod";
import { badRequest } from "./errors";

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`)
    .join("; ");
}

/** Validate an already-parsed object against a schema. */
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(formatIssues(result.error), result.error.flatten());
  }
  return result.data;
}

/** Read a JSON request body and validate it. */
export async function parseJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return parse(schema, raw);
}

/** Turn a multipart FormData into a plain object and validate it. */
export function parseForm<T>(form: FormData, schema: z.ZodType<T>): T {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    // Files are left as-is; everything else becomes a string.
    obj[key] = value instanceof File ? value : String(value);
  }
  return parse(schema, obj);
}
