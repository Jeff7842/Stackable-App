import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/supabase-admin';
import { generateSessionToken, getClientIp, getUserAgent, hashToken } from '@/lib/auth-utils';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body?.userId ?? '');
    const otpCode = String(body?.otp ?? '').trim();

    if (!userId || !otpCode) {
      return NextResponse.json({ error: 'Missing userId or otp.' }, { status: 400 });
    }

    const { data: user, error: userError } = await createSupabaseClient
      .from('users')
      .select('id, school_id, school_code, first_name, last_name, email, role, must_change_password, status')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Your account is not active yet.' }, { status: 403 });
    }

    const nowIso = new Date().toISOString();

    const { data: otpRow, error: otpError } = await createSupabaseClient
      .from('user_otps')
      .select('id, otp_code, expires_at, consumed_at')
      .eq('user_id', user.id)
      .eq('school_code', user.school_code)
      .eq('otp_code', otpCode)
      .is('consumed_at', null)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      return NextResponse.json({ error: 'Failed to verify OTP.' }, { status: 500 });
    }

    if (!otpRow) {
      return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 401 });
    }

    const consumedAt = new Date().toISOString();

    const { error: consumeError } = await createSupabaseClient
      .from('user_otps')
      .update({ consumed_at: consumedAt })
      .eq('id', otpRow.id)
      .is('consumed_at', null);

    if (consumeError) {
      return NextResponse.json({ error: 'Failed to consume OTP.' }, { status: 500 });
    }

    const rawSessionToken = generateSessionToken();
    const refreshTokenHash = hashToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: sessionError } = await createSupabaseClient.from('user_sessions').insert({
      user_id: user.id,
      school_id: user.school_id,
      session_type: 'web',
      refresh_token_hash: refreshTokenHash,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      expires_at: expiresAt,
    });

    if (sessionError) {
      return NextResponse.json({ error: 'OTP valid, but failed to create session.' }, { status: 500 });
    }

    const cookieStore = await cookies();
    cookieStore.set('stackable_session', rawSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(expiresAt),
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        schoolId: user.school_id,
        schoolCode: user.school_code,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        mustChangePassword: !!user.must_change_password,
      },
      redirectTo: user.must_change_password ? '/change-password' : '/dashboard',
    });
  } catch (error) {
    console.error('verify otp route error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
