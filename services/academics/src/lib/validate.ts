import { errors } from "@stackable/service-kit";

// academics cannot import zod (not in its dependencies), so this is a small schema kit with the same envelope.
interface Issue {
  path: string;
  message: string;
}

export type Schema<T> = (value: unknown, path: string, issues: Issue[]) => T;
export type Infer<S> = S extends Schema<infer T> ? T : never;

const MAX_TEXT_LENGTH = 10_000; // bounds every free-text field so one request cannot store megabytes
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTERNAL_ID_PATTERN = /^[\w.:-]{1,128}$/; // ids owned by other services may not be uuids
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

function bad<T>(issues: Issue[], path: string, message: string): T {
  issues.push({ path, message });
  return undefined as T;
}

export const string =
  ({ min = 1, max = MAX_TEXT_LENGTH }: { min?: number; max?: number } = {}): Schema<string> =>
  (v, p, i) => {
    if (typeof v !== "string") return bad(i, p, "must be a string");
    const s = v.trim();
    if (s.length < min || s.length > max) return bad(i, p, `length must be ${min} to ${max}`);
    return s;
  };

export const uuid = (): Schema<string> => (v, p, i) =>
  typeof v === "string" && UUID_PATTERN.test(v) ? v : bad(i, p, "must be a uuid");

export const externalId = (): Schema<string> => (v, p, i) =>
  typeof v === "string" && EXTERNAL_ID_PATTERN.test(v) ? v : bad(i, p, "must be a valid id");

export const num =
  ({ min = -1e9, max = 1e9 }: { min?: number; max?: number } = {}): Schema<number> =>
  (v, p, i) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return bad(i, p, "must be a number");
    return v < min || v > max ? bad(i, p, `must be between ${min} and ${max}`) : v;
  };

/** coerce accepts numeric strings so the same schema serves query parameters. */
export const int =
  ({ min = 0, max = 1_000_000, coerce = false }: { min?: number; max?: number; coerce?: boolean } = {}): Schema<number> =>
  (v, p, i) => {
    const n = coerce && typeof v === "string" && v.trim() !== "" ? Number(v) : v;
    if (typeof n !== "number" || !Number.isInteger(n)) return bad(i, p, "must be an integer");
    return n < min || n > max ? bad(i, p, `must be between ${min} and ${max}`) : n;
  };

export const bool = (): Schema<boolean> => (v, p, i) =>
  typeof v === "boolean" ? v : bad(i, p, "must be true or false");

/** Accepts an ISO 8601 timestamp and returns it normalised to UTC. */
export const isoDate = (): Schema<string> => (v, p, i) => {
  if (typeof v !== "string" || !ISO_PATTERN.test(v) || Number.isNaN(Date.parse(v))) {
    return bad(i, p, "must be an ISO 8601 timestamp");
  }
  return new Date(v).toISOString();
};

export const oneOf =
  <const V extends readonly string[]>(values: V): Schema<V[number]> =>
  (v, p, i) =>
    typeof v === "string" && values.includes(v) ? (v as V[number]) : bad(i, p, `must be one of ${values.join(", ")}`);

export const optional =
  <T>(schema: Schema<T>): Schema<T | undefined> =>
  (v, p, i) =>
    v === undefined || v === null ? undefined : schema(v, p, i);

export const array =
  <T>(item: Schema<T>, { min = 0, max = 500 }: { min?: number; max?: number } = {}): Schema<T[]> =>
  (v, p, i) => {
    if (!Array.isArray(v)) return bad(i, p, "must be an array");
    if (v.length < min || v.length > max) return bad(i, p, `must have ${min} to ${max} items`);
    return v.map((x, idx) => item(x, `${p}[${idx}]`, i));
  };

export const any = (): Schema<unknown> => (v) => v;

export function object<S extends Record<string, Schema<unknown>>>(shape: S): Schema<{ [K in keyof S]: Infer<S[K]> }> {
  return (v, p, i) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return bad(i, p, "must be an object");
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      out[key] = shape[key]((v as Record<string, unknown>)[key], p ? `${p}.${key}` : key, i);
    }
    return out as { [K in keyof S]: Infer<S[K]> };
  };
}

/** Runs a schema over untrusted input and throws the standard 400 envelope listing every failing field. */
export function parse<T>(schema: Schema<T>, input: unknown): T {
  const issues: Issue[] = [];
  const value = schema(input, "", issues);
  if (issues.length > 0) throw errors.validation("Request validation failed", { fields: issues });
  return value;
}

/** Reads a JSON body; a malformed body is a 400, never a 500. */
export async function readJson(c: { req: { json(): Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw errors.validation("Malformed JSON body");
  }
}
