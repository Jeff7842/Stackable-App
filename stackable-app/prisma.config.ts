// =============================================================================
// Prisma 7 config — used by the Prisma CLI (db pull, migrate, studio).
// -----------------------------------------------------------------------------
// In Prisma 7 the connection URL is NOT in schema.prisma anymore; the CLI reads
// it from here. The CLI does not auto-load env files, so we load .env.local
// ourselves.
//
// For migrations we prefer DIRECT_URL (a non-pooled connection) and fall back
// to DATABASE_URL. (The running app connects separately via the pg adapter in
// lib/db/prisma.ts.)
// =============================================================================

import { defineConfig } from "prisma/config";

// Load .env.local for the CLI (Next.js loads it for the app automatically).
try {
  // Node 20.12+/22+ provides process.loadEnvFile.
  (
    process as NodeJS.Process & { loadEnvFile?: (p: string) => void }
  ).loadEnvFile?.(".env.local");
} catch {
  // .env.local may not exist yet — that's fine.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // PRISMA_DB_URL is a one-off override used ONLY when introspecting the old
    // Supabase database (`pnpm db:pull`). Normal commands (migrate) use Neon via
    // DIRECT_URL. It is not in .env.local, so it only applies when set inline.
    url:
      process.env.PRISMA_DB_URL ??
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "",
  },
  migrations: {
    path: "prisma/migrations",
  },
});
