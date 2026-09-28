import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { hashToken } from '@/lib/auth-utils';
import { toErrorResponse } from '@/lib/api/errors';
import { MAX_OTP_ATTEMPTS, OTP_TTL_MS, authLimit, hashCode, safeEqual } from '@/lib/auth/otp';
import {
  findActiveUsersByEmail,
  findLiveReset,
  issueResetToken,
  killReset,
  reserveResetAttempt,
} from '@/lib/repositories/auth.repo';
import { verifyResetCodeSchema } from '@/lib/validation/auth';

// One message for every failure (unknown email, wrong code, expired, locked out),
// so the response never reveals whether an account exists.
const FAIL = 'That code is not right or has expired. Request a new one if you need to.';

export async function POST(req: Request) {
  try {
    const parsed = verifyResetCodeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 });
    }
    const email = parsed.data.email.trim().toLowerCase();
    const code = parsed.data.code;

    await authLimit(`resetverify:${email}`);

    const users = await findActiveUsersByEmail(email);
    const user = users.length === 1 && users[0].status === 'active' ? users[0] : null;
    if (!user) return NextResponse.json({ error: FAIL }, { status: 401 });

    const row = await findLiveReset(user.id, new Date());
    if (!row || row.attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json({ error: FAIL }, { status: 401 });
    }

    // Reserve an attempt first (compare-and-set) so parallel guesses can't exceed the cap.
    if (!(await reserveResetAttempt(row.id, row.attempts))) {
      return NextResponse.json({ error: 'Please wait a moment and try again.' }, { status: 429 });
    }

    if (!safeEqual(hashCode('reset', user.id, code), row.code_hash)) {
      if (row.attempts + 1 >= MAX_OTP_ATTEMPTS) await killReset(row.id);
      return NextResponse.json({ error: FAIL }, { status: 401 });
    }

    // Correct: burn the code and hand back a short-lived, single-use reset token.
    const resetToken = crypto.randomBytes(32).toString('hex');
    const issued = await issueResetToken(row.id, hashToken(resetToken), new Date(Date.now() + OTP_TTL_MS));
    if (!issued) return NextResponse.json({ error: FAIL }, { status: 401 });

    return NextResponse.json({ ok: true, resetToken });
  } catch (error) {
    return toErrorResponse(error);
  }
}
