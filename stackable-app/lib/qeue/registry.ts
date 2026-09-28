// =============================================================================
// Job registry — which background jobs exist and the code that runs them.
// -----------------------------------------------------------------------------
// WHY THIS IS NOT IN app/api/jobs/[job]/route.ts: Next.js only allows HTTP methods
// (GET, POST, ...) and a few config names (dynamic, runtime, ...) to be exported
// from a route.ts. Any other export, such as JOB_HANDLERS, fails `next build`
// with "... is not a valid Route export field". So the registry lives here and
// the route file imports it.
//
// TO ADD A JOB: write an async function that takes the payload and is safe to run
// twice (QStash retries), add it below under a name matching /^[a-z0-9][a-z0-9-]*$/,
// and call enqueueJob("<name>", payload) from a route. If it throws, the route
// answers 500 and QStash retries later.
//
// =============================================================================

// Payloads arrive from the queue as parsed JSON, so each handler declares the
// shape it expects (and should validate it with zod). `any` is what lets a handler
// take its own payload type instead of `unknown`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobHandler = (payload: any) => Promise<void>;

/**
 * Payload for the "send-otp" job: one queued message delivers a login or
 * password-reset code by email (required, via Resend) and, when the account has a
 * usable phone on file, by SMS too (best-effort - see sendOtp() below).
 */
export type SendOtpPayload = {
  email: string;
  firstName: string;
  otpCode: string;
  purpose: "login" | "reset";
  /** Already normalized by lib/auth-utils.ts#resolveSmsPhone; omit/null to skip SMS. */
  phone?: string | null;
};

async function sendOtp(payload: SendOtpPayload): Promise<void> {
  const { Resend } = await import("resend");
  const { default: OtpEmail } = await import("@/components/email/otp-email");

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) throw new Error("RESEND_FROM_EMAIL is not set");

  // Email is the primary, reliable channel: a failure here throws, so QStash retries.
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: payload.email,
    subject: payload.purpose === "reset" ? "Reset your Stackable password" : "Your Stackable verification code",
    react: OtpEmail({ firstName: payload.firstName, otpCode: payload.otpCode, purpose: payload.purpose }),
  });
  if (error) throw new Error(`OTP email failed to send: ${error.message}`);

  // SMS is a supplementary channel: log and move on, never fail (retry) the whole job over it.
  if (!payload.phone) return;
  try {
    const { infobip } = await import("@/lib/infobib/infobib");
    const message =
      payload.purpose === "reset"
        ? `Hi ${payload.firstName}, your Stackable password reset code is ${payload.otpCode}. It expires in 10 minutes.`
        : `Hi ${payload.firstName}, your Stackable verification code is ${payload.otpCode}. It expires in 10 minutes.`;
    const response = await infobip.channels.sms.send({
      messages: [
        {
          sender: process.env.INFOBIP_SENDER || "Stackable",
          destinations: [{ to: payload.phone }],
          content: { text: message },
        },
      ],
    });
    console.info("[send-otp] sms sent", { status: response?.messages?.[0]?.status });
  } catch (smsError) {
    console.error("[send-otp] sms failed (email already sent, not retrying)", smsError);
  }
}

export const JOB_HANDLERS: Record<string, JobHandler> = {
  // Used by tests to prove the queue -> route -> handler path works. Does nothing.
  noop: async () => {},
  "send-otp": sendOtp,
};

/** Find a handler by job name, or undefined. Own keys only, so "constructor" is not a job. */
export function findJobHandler(name: string): JobHandler | undefined {
  return Object.hasOwn(JOB_HANDLERS, name) ? JOB_HANDLERS[name] : undefined;
}
