import { supabase } from "@/lib/supabase";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  const { userId, schoolCode, email } = await req.json();

  const otp = Math.floor(10000 + Math.random() * 90000).toString();
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  await supabase.from("user_otps").insert({
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
    html: `<!-- Header -->
      <tr>
        <td align="center" style="padding:24px;">
          <h3 style="margin:0; font-size:20px; font-weight:700; color:#000000;">
            Sign in to {{project_name}}
          </h3>
        </td>
      </tr>

      <!-- Greeting -->
      <tr>
        <td align="center" style="padding:16px 24px;">
          <p style="margin:0; font-size:14px; color:#474849;">
            Hi, this is your one-time password for signing in:
          </p>
        </td>
      </tr>

      <!-- OTP -->
      <tr>
        <td align="center" style="padding:16px 24px;">
          <p style="margin:0; font-size:24px; font-weight:700; font-family:Courier, monospace; color:#000000;">
            ${otp}
          </p>
        </td>
      </tr>

      <!-- Magic Link -->
      <tr>
        <td align="center" style="padding:16px 24px;">
          <p style="margin:0; font-size:14px; color:#000000;">
            Or you can click on
            <a href="{{magic_link}}" target="_blank" rel="noopener noreferrer" style="color:#2563eb; text-decoration:underline;">
              this link
            </a>
            to sign in.
          </p>
        </td>
      </tr>

      <!-- Divider -->
      <tr>
        <td style="padding:16px 24px;">
          <hr style="border:none; border-top:1px solid #e5e7eb;" />
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td align="center" style="padding:8px 24px 24px;">
          <p style="margin:0; font-size:12px; color:#474849;">
            If you were not expecting this email, you can safely ignore it.
          </p>
        </td>
      </tr>

    </table>
  </td>
</tr>




`,
  });

  return Response.json({ sent: true });
}
