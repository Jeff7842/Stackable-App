import crypto from 'crypto';

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

export function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return null;
}

export function getUserAgent(req: Request) {
  return req.headers.get('user-agent');
}

export function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0] ?? '*'}*@${domain}`;
  return `${name[0]}${'*'.repeat(Math.max(1, name.length - 2))}${name[name.length - 1]}@${domain}`;
}
