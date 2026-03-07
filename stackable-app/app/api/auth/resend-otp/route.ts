import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseClient } from '@/lib/supabase/supabase-admin';
import { generateOtp, getClientIp, getUserAgent, maskEmail } from '@/lib/auth-utils';
import OtpEmail from '@/components/email/otp-email';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body?.userId ?? '');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });
    }

    const { data: user, error } = await createSupabaseClient
      .from('users')
      .select('id, email, school_code, first_name, status')
      .eq('id', userId)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Your account is not active yet.' }, { status: 403 });
    }

    await createSupabaseClient
      .from('user_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('school_code', user.school_code)
      .is('consumed_at', null);

    const otpCode = generateOtp(5);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: otpInsertError } = await createSupabaseClient.from('user_otps').insert({
      user_id: user.id,
      school_code: user.school_code,
      otp_code: otpCode,
      channel: 'email',
      expires_at: expiresAt,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
    });

    if (otpInsertError) {
      return NextResponse.json({ error: 'Failed to create OTP.' }, { status: 500 });
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!fromEmail) {
      return NextResponse.json({ error: 'Missing RESEND_FROM_EMAIL.' }, { status: 500 });
    }

    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject: 'Your Stackable verification code',
      react: OtpEmail({ firstName: user.first_name, otpCode }),
    });

    if (sendError) {
      return NextResponse.json({ error: 'OTP email failed to send.' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      maskedEmail: maskEmail(user.email),
      message: 'A new OTP has been sent.',
    });
  } catch (error) {
    console.error('resend otp route error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
