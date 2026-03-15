import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
//import { Resend } from 'resend';
import { createSupabaseClient } from '@/lib/supabase/supabase-admin';
import { generateOtp, getClientIp, getUserAgent, maskEmail } from '@/lib/auth-utils';
import { qstash } from "@/lib/qeue/qstash";
//import { pingram } from "@/lib/pingram/pingram";
import { infobip } from "@/lib/infobib/infobib";


//const resend = new Resend(process.env.RESEND_API_KEY);


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
      .select('id, school_id, school_code, email, phone, phone_2, password_hash, first_name, last_name, role, status, must_change_password')
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
  url: `${process.env.APP_BASE_URL}/api/jobs/send-otp-email`,
  body: {
    email: user.email,
    firstName: user.first_name,
    otpCode,
  },
});

const rawPhone = String(user.phone ?? user.phone_2 ?? "").trim();

// Remove everything except digits
let normalizedPhone = rawPhone.replace(/\D/g, "");

// Convert local formats to 2547XXXXXXXX / 2541XXXXXXXX
if (normalizedPhone.startsWith("0")) {
  normalizedPhone = "254" + normalizedPhone.slice(1);
}

// Convert 7XXXXXXXX or 1XXXXXXXX to 2547XXXXXXXX / 2541XXXXXXXX
if (/^[71]\d{8}$/.test(normalizedPhone)) {
  normalizedPhone = "254" + normalizedPhone;
}

// Final validation for Kenya mobile numbers
if (!/^254[17]\d{8}$/.test(normalizedPhone)) {
  return NextResponse.json(
    { error: "Invalid or missing phone number." },
    { status: 400 }
  );
}

const phoneNumber = `${normalizedPhone}`;

/*await pingram.send({
  type: 'stackable_security_code',
  to: {
    id:String(user.school_id ?? user.id),
    number:`+254${user.phone ?? user.phone_2}`, // Replace with your phone number, use format [+][country code][area code][local number]
  },
  sms: {
    message: `Hi ${user.first_name}, Your verification code is: ${otpCode}. Reply STOP to opt-out.`
  }
});*/

try {
  const response = await infobip.channels.sms.send({
    messages: [
      {
        sender: process.env.INFOBIP_SENDER || "ServiceSMS",
        destinations: [{ to: phoneNumber}],
        content: {
          text: `Hi ${user.first_name}, your verification code is ${otpCode}. If you did not request it, please ignore this message.`,
        },
      },
    ],
    headers: {
      Authorization: `App ${process.env.INFOBIP_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  console.log("Infobip SMS response:", {
  status: response?.messages?.[0]?.status,
  to: response?.messages?.[0]?.to,
  messageId: response?.messages?.[0]?.messageId,
});
} catch (smsError) {
  console.error("Infobip SMS failed:", smsError);
  // Do not fail login if email OTP is already queued
}

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
