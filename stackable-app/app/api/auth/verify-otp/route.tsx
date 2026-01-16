import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { stackAuth } from "@/lib/stack-auth";


export async function POST(req: Request) {
  const { userId, otp } = await req.json();
  const hash = crypto.createHash("sha256").update(otp).digest("hex");

  const { data: record } = await supabase
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

  await supabase
    .from("user_otps")
    .update({ consumed_at: new Date() })
    .eq("id", record.id);

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (stackAuth as any).signIn({
    userId: user.id,
    email: user.email,
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/handler/sign-in`,
    metadata: {
      role: user.role,
      school_code: user.school_code,
    },
  });
  

  return Response.json({ success: true });
}
