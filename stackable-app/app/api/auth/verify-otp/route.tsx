import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { stackAuth } from "@/lib/stack-auth";

export async function POST(req: Request) {
  const { userId, otp } = await req.json();
  const hash = crypto.createHash("sha256").update(otp).digest("hex");

  const { data: record } = await supabaseAdmin
    .from("user_otps")
    .select("*")
    .eq("user_id", userId)
    .eq("otp_code", hash)
    .is("consumed_at", null)
    .gt("expires_at", new Date())
    .single();

  if (!record) {
    return Response.json({ error: "Invalid OTP" }, { status: 401 });
  }

  await supabaseAdmin
    .from("user_otps")
    .update({ consumed_at: new Date() })
    .eq("id", record.id);

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  await stackAuth.signIn({
    userId: user.id,
    email: user.email,
    metadata: {
      role: user.role,
      school_code: user.school_code,
    },
  });

  return Response.json({ success: true });
}
