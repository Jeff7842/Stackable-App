import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateSessionToken, getClientIp, getUserAgent, hashToken } from '@/lib/auth-utils';
import {
  MAX_OTP_ATTEMPTS,
  OTP_CHALLENGE_COOKIE,
  hashCode,
  readChallenge,
  safeEqual,
} from '@/lib/auth/otp';
import {
  consumeOtp,
  createSession,
  findUserById,
  getOtp,
  reserveOtpAttempt,
} from '@/lib/repositories/auth.repo';
import { ROLE_HOME, type Role } from '@/lib/validation/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const otpCode = String(body?.otp ?? '').trim();
    const remember = body?.remember === true;

    if (!/^\d{5}$/.test(otpCode)) {
      return NextResponse.json({ error: 'Enter the 5-digit code.' }, { status: 400 });
    }

    // The OTP row comes from the signed cookie set by /login - never from the request body.
    const store = await cookies();
    const otpId = readChallenge(store.get(OTP_CHALLENGE_COOKIE)?.value);
    if (!otpId) {
      return NextResponse.json({ error: 'Your verification session expired. Please sign in again.' }, { status: 401 });
    }

    const row = await getOtp(otpId);

    if (!row || row.purpose !== 'login' || row.consumed_at || row.expires_at.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired OTP. Please sign in again.' }, { status: 401 });
    }

    if (row.attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many wrong codes. Please sign in again.' }, { status: 401 });
    }

    // Reserve an attempt BEFORE checking the code. The compare-and-set means parallel guesses
    // cannot all pass: only one request wins each slot, so 5 is a hard cap.
    if (!(await reserveOtpAttempt(row.id, row.attempts))) {
      return NextResponse.json({ error: 'Please wait a moment and try again.' }, { status: 429 });
    }

    if (!safeEqual(hashCode('login', row.user_id, otpCode), row.otp_code)) {
      const attemptsLeft = MAX_OTP_ATTEMPTS - (row.attempts + 1);
      if (attemptsLeft <= 0) await consumeOtp(row.id);
      return NextResponse.json(
        {
          error:
            attemptsLeft > 0
              ? `That code isn't right. ${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`
              : 'Too many wrong codes. Please sign in again.',
          attemptsLeft,
        },
        { status: 401 },
      );
    }

    // Single use: only one request can flip the code from live to consumed.
    if (!(await consumeOtp(row.id))) {
      return NextResponse.json({ error: 'Invalid or expired OTP. Please sign in again.' }, { status: 401 });
    }

    const user = await findUserById(row.user_id);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Your account is not active yet.' }, { status: 403 });
    }

    const rawSessionToken = generateSessionToken();
    // Remember me: 30-day persistent cookie. Otherwise a browser-session cookie, capped at 24h server-side.
    const expiresAt = new Date(Date.now() + (remember ? 30 * DAY_MS : DAY_MS));

    await createSession({
      userId: user.id,
      schoolId: user.school_id,
      tokenHash: hashToken(rawSessionToken),
      expiresAt,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    store.set('stackable_session', rawSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      ...(remember ? { expires: expiresAt } : {}),
    });
    store.delete({ name: OTP_CHALLENGE_COOKIE, path: '/api/auth' });

    // First-login / admin-forced password change goes through the same reset flow.
    const redirectTo = user.must_change_password
      ? `/forgot-password?reason=change&email=${encodeURIComponent(user.email ?? '')}`
      : ROLE_HOME[user.role as Role] ?? '/login';

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
        mustChangePassword: user.must_change_password,
      },
      redirectTo,
    });
  } catch (error) {
    console.error('verify otp route error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
