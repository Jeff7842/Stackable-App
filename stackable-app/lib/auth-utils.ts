import crypto from 'crypto';
import { isIP } from 'net';

export function generateOtp(length = 5) {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += crypto.randomInt(0, 10).toString();
  }
  return otp;
}

export function hashToken(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

// The value goes into `inet` columns (user_sessions / user_otps / password_resets), and the
// header is client-controlled, so only return something that really is an IP. A junk header
// then means "no ip recorded" instead of a failed INSERT.
export function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0].trim();
  return first && isIP(first) !== 0 ? first : null;
}

export function getUserAgent(req: Request) {
  return req.headers.get('user-agent');
}

/**
 * Kenyan mobile number -> "2547XXXXXXXX" / "2541XXXXXXXX" (what Infobip/Pingram expect),
 * or null when it is not a plausible Kenyan mobile number. Never throws, never blocks a
 * caller: SMS is a best-effort extra channel, not a requirement to sign in or reset a password.
 */
export function normalizeKenyanPhone(raw: string | number | bigint | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `254${digits.slice(1)}`;
  else if (/^[71]\d{8}$/.test(digits)) digits = `254${digits}`;
  return /^254[17]\d{8}$/.test(digits) ? digits : null;
}

/** The first phone on the account that is a plausible Kenyan mobile number, or null. */
export function resolveSmsPhone(user: {
  phone?: bigint | number | string | null;
  phone_2?: bigint | number | string | null;
}): string | null {
  return normalizeKenyanPhone(user.phone) ?? normalizeKenyanPhone(user.phone_2);
}

export function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0] ?? '*'}*@${domain}`;
  return `${name[0]}${'*'.repeat(Math.max(1, name.length - 2))}${name[name.length - 1]}@${domain}`;
}
