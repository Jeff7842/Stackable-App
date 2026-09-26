// =============================================================================
// Prisma client — the single, shared door to our database.
// -----------------------------------------------------------------------------
// WHY a singleton? In development Next.js reloads your code a lot. If we made a
// brand-new PrismaClient every reload, we'd open hundreds of database
// connections and run out. So we keep ONE client on the global object and reuse
// it. In production we just make one normally.
//
// Prisma 7 talks to Postgres through a "driver adapter" (here: node-postgres /
// pg). The connection string comes from DATABASE_URL (the pooled URL on Neon,
// or the local URL on the VPS).
//
// RULE: only files in lib/repositories/* are allowed to import this. Everything
// else (API routes, pages) talks to repositories, never to Prisma directly.
// =============================================================================

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
