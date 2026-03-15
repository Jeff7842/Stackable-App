import { NextResponse } from "next/server";
import { Resend } from "resend";
import { Receiver } from "@upstash/qstash";
import OtpEmail from "@/components/email/otp-email";

const resend = new Resend(process.env.RESEND_API_KEY);

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();

    const signature = req.headers.get("upstash-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature." }, { status: 401 });
    }

    const isValid = await receiver.verify({
      signature,
      body: bodyText,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    const body = JSON.parse(bodyText) as {
      email: string;
      firstName: string;
      otpCode: string;
    };

    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!fromEmail) {
      return NextResponse.json({ error: "Missing RESEND_FROM_EMAIL." }, { status: 500 });
    }

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: body.email,
      subject: "Your Stackable verification code",
      react: OtpEmail({
        firstName: body.firstName,
        otpCode: body.otpCode,
      }),
    });

    if (error) {
      return NextResponse.json({ error: "Failed to send OTP email." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("send-otp-email job error", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}