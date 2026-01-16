import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  const { userId, schoolCode, email } = await req.json();

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  await supabaseAdmin.from("user_otps").insert({
    user_id: userId,
    school_code: schoolCode,
    otp_code: hashedOtp,
    channel: "email",
    expires_at: new Date(Date.now() + 5 * 60 * 1000),
  });

  await resend.emails.send({
    from: "Stackable <auth@stackable.kyfaru.com>",
    to: email,
    subject: "Your verification code",
    html: `<h2>${otp}</h2><p>Expires in 5 minutes</p>`,
  });

  return Response.json({ sent: true });
}
