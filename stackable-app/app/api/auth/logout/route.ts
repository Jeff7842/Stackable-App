import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/supabase-admin';
import { hashToken } from '@/lib/auth-utils';

export async function POST() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get('stackable_session')?.value;

  if (rawToken) {
    await createSupabaseClient
      .from('user_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('refresh_token_hash', hashToken(rawToken))
      .is('revoked_at', null);
  }

  cookieStore.delete('stackable_session');
  return NextResponse.json({ ok: true });
}
