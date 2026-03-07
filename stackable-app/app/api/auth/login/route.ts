import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import { createSupabaseClient } from '@/lib/supabase/supabase-admin';
import { generateOtp, getClientIp, getUserAgent, maskEmail } from '@/lib/auth-utils';
import { qstash } from "@/lib/qeue/qstash";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const { data: user, error } = await createSupabaseClient
      .from('users')
      .select('id, school_id, school_code, email, password_hash, first_name, last_name, role, status, must_change_password')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Database error while reading user.' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Your account is not active yet.' }, { status: 403 });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const otpCode = generateOtp(5);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);

    await createSupabaseClient
      .from('user_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('school_code', user.school_code)
      .is('consumed_at', null);

    const { error: otpInsertError } = await createSupabaseClient.from('user_otps').insert({
      user_id: user.id,
      school_code: user.school_code,
      otp_code: otpCode,
      channel: 'email',
      expires_at: expiresAt,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (otpInsertError) {
      return NextResponse.json({ error: 'Failed to create OTP.' }, { status: 500 });
    }

    await qstash.publishJSON({
  url: `${process.env.APP_BASE_URL}/api/job/send-otp-email`,
  body: {
    email: user.email,
    firstName: user.first_name,
    otpCode,
  },
});

    return NextResponse.json({
      ok: true,
      userId: user.id,
      schoolId: user.school_id,
      schoolCode: user.school_code,
      email: user.email,
      maskedEmail: maskEmail(user.email),
      firstName: user.first_name,
      mustChangePassword: !!user.must_change_password,
      message: 'Verification code is being sent.',
    });
  } catch (error) {
    console.error('login route error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
