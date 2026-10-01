// =============================================================================
// Better Auth configuration — only active when AUTH_PROVIDER=betterauth.
// The existing legacy auth (OTP cookie) remains the default and is unaffected.
// =============================================================================

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { prisma } from "@/lib/db/prisma";
import { findUsersByEmail } from "@/lib/repositories/auth.repo";
import bcryptjs from "bcryptjs";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Our Prisma models are named ba_user/ba_session/ba_account/ba_verification
  // (schema.prisma, "additive — do not alter existing models"), not Better
  // Auth's defaults ("user"/"session"/"account"/"verification"). Map each one
  // explicitly, or the adapter looks for a model that doesn't exist.
  user: {
    modelName: "ba_user",
    // Custom fields that guard.ts's betterauth branch reads off session.user.
    // Declaring the DB column isn't enough — Better Auth only serializes
    // fields it's told about.
    additionalFields: {
      schoolId: { type: "string", required: false, input: false },
      role: { type: "string", required: false, input: false },
      schoolCode: { type: "string", required: false, input: false },
      status: { type: "string", required: false, input: false },
      mustChangePassword: { type: "boolean", required: false, input: false },
    },
  },
  account: { modelName: "ba_account" },
  verification: { modelName: "ba_verification" },

  // Email + password primary auth
  emailAndPassword: {
    enabled: true,
    // Detect legacy bcrypt hashes (start with $2b/$2a) and verify with bcryptjs.
    // On successful verify, Better Auth will re-hash with its default (scrypt).
    password: {
      verify: async ({
        hash,
        password,
      }: {
        hash: string;
        password: string;
      }) => {
        if (hash.startsWith("$2")) {
          return bcryptjs.compare(password, hash);
        }
        // Return undefined to signal "use Better Auth's default scrypt verifier"
        return undefined as unknown as boolean;
      },
    },
    // Matches the legacy flow: "You've been signed out everywhere" after a reset.
    revokeSessionsOnPasswordReset: true,
  },

  // Google OAuth. This app has no public self-signup (accounts are
  // admin-provisioned per school — lib/validation/user-admin.ts), so new
  // accounts are never created here: databaseHooks.user.create.before below
  // links a Google sign-in to the matching legacy `users` row by email, or
  // rejects it if none exists.
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const [legacy] = await findUsersByEmail(user.email, 1);
          if (!legacy) {
            // No matching admin-provisioned account: refuse to create one.
            throw new Error("No account found for this email. Ask your school admin to add you first.");
          }
          return {
            data: {
              ...user,
              name: user.name || `${legacy.first_name} ${legacy.last_name}`.trim(),
              emailVerified: true,
              schoolId: legacy.school_id,
              role: legacy.role,
              schoolCode: legacy.school_code,
              status: legacy.status,
              mustChangePassword: legacy.must_change_password,
            },
          };
        },
      },
    },
  },

  // Two-factor: both an authenticator app (TOTP) and an emailed code are
  // available; the login UI lets the user pick between them.
  plugins: [
    twoFactor({
      otpOptions: {
        // Matches the legacy flow's 5-digit code (app/login/page.tsx's UseOtp(5)).
        digits: 5,
        sendOTP: async ({
          user,
          otp,
        }: {
          user: { email: string; name?: string };
          otp: string;
        }) => {
          // Same queued "send-otp" job the legacy login route uses (lib/qeue/registry.ts).
          const { enqueueJob } = await import("@/lib/qeue/jobs");
          await enqueueJob("send-otp", {
            email: user.email,
            firstName: user.name || "there",
            otpCode: otp,
            purpose: "login",
          });
        },
      },
      totpOptions: {},
      // Our Prisma model is ba_two_factor, not the plugin's default "twoFactor".
      schema: {
        twoFactor: { modelName: "ba_two_factor" },
      },
    }),

    // Forgot-password: same 3-step "email -> 6-digit code -> new password" UX as the
    // legacy flow (app/forgot-password/page.tsx), just issued/verified by Better Auth
    // instead of the bespoke /api/auth/forgot-password routes.
    emailOTP({
      otpLength: 6,
      expiresIn: 10 * 60, // matches the legacy OTP_TTL_MS (lib/auth/otp.ts)
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "forget-password") return; // this app only uses email-otp for resets
        const { enqueueJob } = await import("@/lib/qeue/jobs");
        const [legacy] = await findUsersByEmail(email, 1);
        await enqueueJob("send-otp", {
          email,
          firstName: legacy?.first_name || "there",
          otpCode: otp,
          purpose: "reset",
        });
      },
    }),
  ],

  // Session uses DB (Prisma adapter) — no Redis required.
  session: {
    modelName: "ba_session",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh session if older than 1 day
    // cookieCache is intentionally omitted — it requires Redis which is not
    // configured yet. Will be enabled in a later workstream.
  },

  // Trust requests from our own domain only.
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type BetterAuthUser = typeof auth.$Infer.Session.user;
