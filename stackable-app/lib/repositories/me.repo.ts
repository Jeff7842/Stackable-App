// =============================================================================
// "Me" repository — the display fields GET /api/auth/me returns for the signed-in
// user, on Prisma + plain PostgreSQL.
// -----------------------------------------------------------------------------
// Only the columns the navbar needs are selected: never password_hash or anything
// else. Only repositories may import lib/db/prisma.
// =============================================================================

import { prisma } from "@/lib/db/prisma";

export type MeProfile = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  schoolName?: string;
};

/**
 * Load a user's name, e-mail and school name.
 *
 * @returns null when the user row no longer exists (the caller treats that as signed out)
 */
export async function findMeProfile(userId: string, schoolId: string): Promise<MeProfile | null> {
  const [user, school] = await Promise.all([
    prisma.users.findUnique({
      where: { id: userId },
      select: { first_name: true, last_name: true, email: true },
    }),
    // The school name is decoration: a failed lookup must not block the whole endpoint.
    prisma.schools.findUnique({ where: { id: schoolId }, select: { name: true } }).catch((err: unknown) => {
      console.warn("[me] school name lookup failed:", (err as { code?: string }).code ?? "unknown error");
      return null;
    }),
  ]);
  if (!user) return null;
  return {
    firstName: user.first_name ?? null,
    lastName: user.last_name ?? null,
    email: user.email ?? null,
    schoolName: school?.name ?? undefined,
  };
}
