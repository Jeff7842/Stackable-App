import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateOtp, getClientIp, getUserAgent, maskEmail, resolveSmsPhone } from '@/lib/auth-utils';
import { enqueueJob } from '@/lib/qeue/jobs';
import {
  MAX_OTP_ATTEMPTS,
  MAX_OTP_SENDS,
  MIN_RESEND_GAP_MS,
  OTP_CHALLENGE_COOKIE,
  OTP_TTL_MS,
  challengeCookieOptions,
  hashCode,
  readChallenge,
  signChallenge,
} from '@/lib/auth/otp';
import { countLoginOtpsSince, findUserById, getOtp, issueLoginOtp } from '@/lib/repositories/auth.repo';

export async function POST(req: Request) {
  try {
    // Which code is being resent comes from the signed cookie set by /login, not from the body.
    const store = await cookies();
    const otpId = readChallenge(store.get(OTP_CHALLENGE_COOKIE)?.value);
    if (!otpId) {
      return NextResponse.json({ error: 'Your verification session expired. Please sign in again.' }, { status: 401 });
    }

    const current = await getOtp(otpId);

    if (!current || current.purpose !== 'login' || current.consumed_at || current.expires_at.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Your verification session expired. Please sign in again.' }, { status: 401 });
    }

    if (current.attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many wrong codes. Please sign in again.' }, { status: 401 });
    }

    // Server-side throttle (the page's cooldown is only cosmetic).
    const sinceLast = Date.now() - current.created_at.getTime();
    if (sinceLast < MIN_RESEND_GAP_MS) {
      const retryAfter = Math.ceil((MIN_RESEND_GAP_MS - sinceLast) / 1000);
      return NextResponse.json(
        { error: `Please wait ${retryAfter}s before requesting another code.`, retryAfter },
        { status: 429 },
      );
    }

    const recentSends = await countLoginOtpsSince(current.user_id, new Date(Date.now() - OTP_TTL_MS));
    if (recentSends >= MAX_OTP_SENDS) {
      return NextResponse.json(
        { error: 'Too many verification codes requested. Please sign in again in a few minutes.' },
        { status: 429 },
      );
    }

    const user = await findUserById(current.user_id);
    if (!user || !user.email) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Your account is not active yet.' }, { status: 403 });
    }

    const otpCode = generateOtp(5);
    const otpRow = await issueLoginOtp({
      userId: user.id,
      schoolCode: user.school_code,
      codeHash: hashCode('login', user.id, otpCode),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    await enqueueJob('send-otp', {
      email: user.email,
      firstName: user.first_name,
      otpCode,
      purpose: 'login',
      phone: resolveSmsPhone(user),
    });

    store.set(OTP_CHALLENGE_COOKIE, signChallenge(otpRow.id), challengeCookieOptions());

    return NextResponse.json({
      ok: true,
      maskedEmail: maskEmail(user.email),
      message: 'A new OTP has been sent.',
      retryAfter: MIN_RESEND_GAP_MS / 1000,
    });
  } catch (error) {
    console.error('resend otp route error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
