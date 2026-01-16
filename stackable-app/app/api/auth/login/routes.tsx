import bcrypt from "bcryptjs";
import { supabase} from "@/lib/supabase";
import { useToast } from "../../,,/../../../components/toast/ToastProvider";

export async function POST(req: Request) {
  console.log("[LOGIN] Request received");

  const { email, password } = await req.json();
  console.log("[LOGIN] Payload parsed", {
    emailProvided: !!email,
    passwordProvided: !!password,
  });

  if (!email || !password) {
    console.warn("[LOGIN] Missing email or password");
    return Response.json(
      { error: "Email and password required" },
      { status: 400 }
    );
  }

  console.log("[LOGIN] Fetching user from database");

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error) {
    console.error("[LOGIN] Supabase error", error);
  }

  if (!user) {
    console.warn("[LOGIN] User not found", { email });
  }

  if (!user || user.status !== "active") {
    console.warn("[LOGIN] Invalid or inactive user", {
      email,
      status: user?.status,
    });
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  console.log("[LOGIN] User found and active", {
    userId: user.id,
    schoolCode: user.school_code,
  });

  console.log("[LOGIN] Comparing password hash");
  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    console.warn("[LOGIN] Password mismatch", { userId: user.id });
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  console.log("[LOGIN] Password validated successfully");

  console.log("[LOGIN] OTP required, responding");
  return Response.json({
    requiresOtp: true,
    userId: user.id,
    schoolCode: user.school_code,
  });
}
