import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { generateOtp, getClientIp, getUserAgent, maskEmail, resolveSmsPhone } from '@/lib/auth-utils';
import { enqueueJob } from '@/lib/qeue/jobs';
import { toErrorResponse } from '@/lib/api/errors';
import {
  OTP_CHALLENGE_COOKIE,
  OTP_TTL_MS,
  MAX_OTP_SENDS,
  authLimit,
  challengeCookieOptions,
  hashCode,
  signChallenge,
} from '@/lib/auth/otp';
import { countLoginOtpsSince, findUsersByEmail, issueLoginOtp, type AuthUser } from '@/lib/repositories/auth.repo';

// Compared against when the email is unknown, so "no such user" costs the same as "wrong password".
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    await authLimit(`login:${email}`);

    // The same email can belong to accounts at different schools: try the password against each
    // (at most 3, always all of them, so timing does not reveal how many exist).
    const candidates = await findUsersByEmail(email);
    let user: AuthUser | null = null;
    if (candidates.length === 0) await bcrypt.compare(password, DUMMY_HASH);
    for (const candidate of candidates) {
      const ok = await bcrypt.compare(password, candidate.password_hash || DUMMY_HASH);
      if (ok && candidate.password_hash && !user) user = candidate;
    }

    // Check the password BEFORE the status, so an inactive account can't be discovered without its password.
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Your account is not active yet.' }, { status: 403 });
    }

    if (!user.email) {
      return NextResponse.json(
        { error: 'This account has no email on file to send a verification code to. Contact your school admin.' },
        { status: 400 },
      );
    }

    // Cap how many codes one account can request in a window (login + resends).
    const recentSends = await countLoginOtpsSince(user.id, new Date(Date.now() - OTP_TTL_MS));
    if (recentSends >= MAX_OTP_SENDS) {
      return NextResponse.json(
        { error: 'Too many verification codes requested. Please wait a few minutes and try again.' },
        { status: 429 },
      );
    }

    const otpCode = generateOtp(5);

    const otpRow = await issueLoginOtp({
      userId: user.id,
      schoolCode: user.school_code,
      codeHash: hashCode('login', user.id, otpCode), // keyed hash, never the digits
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    // Email is required, SMS is a bonus channel when the account has a usable phone on file -
    // either way, a delivery problem never fails the login (the job retries on its own).
    await enqueueJob('send-otp', {
      email: user.email,
      firstName: user.first_name,
      otpCode,
      purpose: 'login',
      phone: resolveSmsPhone(user),
    });

    // Bind the next step (verify-otp / resend-otp) to this exact code and this browser.
    (await cookies()).set(OTP_CHALLENGE_COOKIE, signChallenge(otpRow.id), challengeCookieOptions());

    return NextResponse.json({
      ok: true,
      email: user.email,
      maskedEmail: maskEmail(user.email),
      firstName: user.first_name,
      mustChangePassword: user.must_change_password,
      message: 'Verification code is being sent.',
    });
  } catch (error) {
    console.error('login route error', error);
    return toErrorResponse(error);
  }
}
