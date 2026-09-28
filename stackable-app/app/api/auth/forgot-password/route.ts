import { NextResponse } from 'next/server';
import { generateOtp, getClientIp, getUserAgent, resolveSmsPhone } from '@/lib/auth-utils';
import { enqueueJob } from '@/lib/qeue/jobs';
import { toErrorResponse } from '@/lib/api/errors';
import { OTP_TTL_MS, authLimit, hashCode } from '@/lib/auth/otp';
import { findActiveUsersByEmail, issueResetCode, listResetTimesSince } from '@/lib/repositories/auth.repo';
import { forgotPasswordSchema } from '@/lib/validation/auth';

const RESEND_GAP_MS = 60 * 1000;
const MAX_CODES_PER_HOUR = 5;

// Same answer whether or not the email exists, so this can't be used to find accounts.
const GENERIC = { ok: true, message: 'If that email is registered, a 6-digit code is on its way.' };

export async function POST(req: Request) {
  try {
    const parsed = forgotPasswordSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    const email = parsed.data.email.trim().toLowerCase();

    await authLimit(`forgot:${email}`);

    // Only a single, active account gets a code (an email shared by two schools is ambiguous).
    const users = await findActiveUsersByEmail(email);
    const user = users.length === 1 && users[0].status === 'active' && users[0].email ? users[0] : null;
    if (!user) return NextResponse.json(GENERIC);

    const recent = await listResetTimesSince(user.id, new Date(Date.now() - 60 * 60 * 1000));
    if (recent.length > 0) {
      const sinceLast = Date.now() - recent[0].getTime();
      if (sinceLast < RESEND_GAP_MS || recent.length >= MAX_CODES_PER_HOUR) {
        return NextResponse.json(GENERIC);
      }
    }

    const code = generateOtp(6);
    try {
      await issueResetCode({
        userId: user.id,
        codeHash: hashCode('reset', user.id, code), // keyed hash, never the digits
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
      });
    } catch (err) {
      console.error('forgot-password insert failed', err);
      return NextResponse.json(GENERIC);
    }

    // Queued (not awaited-and-sent inline), so an unknown email and a real one take the same
    // time either way, and delivery is retried by QStash if it fails.
    try {
      await enqueueJob('send-otp', {
        email: user.email!,
        firstName: user.first_name,
        otpCode: code,
        purpose: 'reset',
        phone: resolveSmsPhone(user),
      });
    } catch (err) {
      console.error('forgot-password enqueue failed', err);
    }

    return NextResponse.json(GENERIC);
  } catch (error) {
    return toErrorResponse(error);
  }
}
