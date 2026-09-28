import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { hashToken } from '@/lib/auth-utils';
import { revokeSessionByTokenHash } from '@/lib/repositories/auth.repo';

export async function POST() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get('stackable_session')?.value;

  if (rawToken) {
    try {
      await revokeSessionByTokenHash(hashToken(rawToken));
    } catch (err) {
      // Still clear the cookie below; the session row simply expires on its own.
      console.error('logout: could not revoke session', err);
    }
  }

  cookieStore.delete('stackable_session');
  return NextResponse.json({ ok: true });
}
