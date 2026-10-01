// =============================================================================
// Environment variables — checked, not guessed.
// -----------------------------------------------------------------------------
// This file makes sure the secret settings the app needs (database URL, auth
// secret, Redis, R2...) actually exist and look right. If one is missing, we
// throw a clear error instead of a confusing crash deep in the app.
//
// It is LAZY on purpose: nothing is checked until you call getServerEnv(). That
// way the app keeps running during the migration while we add the new values.
// =============================================================================

import { z } from "zod";

const serverEnvSchema = z.object({
  // Database (Prisma)
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Cloudflare R2
  R2_ENDPOINT: z.string().url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_PUBLIC: z.string().min(1),
  R2_BUCKET_PRIVATE: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/**
 * Read and validate the server environment variables.
 * Call this from server-only code (API routes, repositories). It throws a clear
 * error listing exactly which variables are missing or malformed.
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
