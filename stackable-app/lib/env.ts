// =============================================================================
// Environment variables — checked, not guessed.
// -----------------------------------------------------------------------------
// Call getServerEnv() from server code to get a clear error listing every
// missing or malformed setting. Nothing is checked until it is called.
// Redis and R2 are optional outside production; production requires them.
// =============================================================================

import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";
// Required in production, optional elsewhere.
const prodOnly = <T extends z.ZodTypeAny>(schema: T) => (isProd ? schema : schema.optional());

const serverEnvSchema = z.object({
  // Database (Prisma)
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),

  // Secrets that gate auth and security codes (never have a fallback)
  OTP_HASH_SECRET: z.string().min(1),
  SCHOOL_SECURITY_CODES_SECRET: z.string().min(1),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  // Upstash Redis (rate limits fail closed in production)
  UPSTASH_REDIS_REST_URL: prodOnly(z.string().url()),
  UPSTASH_REDIS_REST_TOKEN: prodOnly(z.string().min(1)),

  // Cloudflare R2
  R2_ENDPOINT: prodOnly(z.string().url()),
  R2_ACCESS_KEY_ID: prodOnly(z.string().min(1)),
  R2_SECRET_ACCESS_KEY: prodOnly(z.string().min(1)),
  R2_BUCKET_PUBLIC: prodOnly(z.string().min(1)),
  R2_BUCKET_PRIVATE: prodOnly(z.string().min(1)),
  R2_PUBLIC_BASE_URL: prodOnly(z.string().url()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/**
 * Read and validate the server environment variables.
 * Throws a clear error listing exactly which variables are missing or malformed.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n` +
        `Copy .env.example to .env.local and fill in the values.`,
    );
  }

  cached = parsed.data;
  return cached;
}
