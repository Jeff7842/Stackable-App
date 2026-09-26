// =============================================================================
// School repository — the ONLY place that reads/writes school data via Prisma.
// -----------------------------------------------------------------------------
// API routes call these functions; they never touch Prisma directly.
//
// Type conversions applied to match JSON output:
//   BigInt -> number, Date -> ISO string.
// =============================================================================

import { prisma } from "@/lib/db/prisma";

export type SchoolListItem = {
  id: string;
  name: string;
  code: string;
  created_at: string;
};

/**
 * List schools, optionally filtered to a specific set of IDs.
 * Returns id, name, code, created_at — matching the shape the admin
 * GET /api/admin/schools handler returns.
 */
export async function listSchools(
  opts: { onlyIds?: string[] } = {},
): Promise<SchoolListItem[]> {
  const where = opts.onlyIds?.length ? { id: { in: opts.onlyIds } } : {};

  const schools = await prisma.schools.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      created_at: true,
    },
  });

  return schools.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    created_at: s.created_at.toISOString(),
  }));
}
