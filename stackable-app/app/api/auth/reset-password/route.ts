import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { hashToken } from '@/lib/auth-utils';
import { toErrorResponse } from '@/lib/api/errors';
import { claimResetToken, completePasswordReset, findUserById } from '@/lib/repositories/auth.repo';
import { resetPasswordSchema } from '@/lib/validation/auth';

export async function POST(req: Request) {
  try {
    const parsed = resetPasswordSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Check your new password and try again.' },
        { status: 400 },
      );
    }
    const { token, newPassword } = parsed.data;

    // Claim the token. Clearing it in the same conditional update makes it single-use: two
    // requests with the same token cannot both succeed.
    const userId = await claimResetToken(hashToken(token), new Date());
    if (!userId) {
      return NextResponse.json(
        { error: 'This reset session has expired. Please start again.' },
        { status: 401 },
      );
    }

    const user = await findUserById(userId);
    if (!user || user.status !== 'active') {
      return NextResponse.json({ error: 'Your account is not active yet.' }, { status: 403 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    try {
      // New password + sign out everywhere + kill leftover codes, all in one transaction.
      await completePasswordReset(userId, passwordHash);
    } catch (err) {
      console.error('reset-password update failed', err);
      return NextResponse.json({ error: 'Could not update your password. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'Password updated. Please sign in.' });
  } catch (error) {
    return toErrorResponse(error);
  }
}
