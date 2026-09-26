// =============================================================================
// Better Auth configuration — only active when AUTH_PROVIDER=betterauth.
// The existing legacy auth (OTP cookie) remains the default and is unaffected.
// =============================================================================

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { prisma } from "@/lib/db/prisma";
import bcryptjs from "bcryptjs";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

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
  },

  // Two-factor OTP plugin
  plugins: [
    twoFactor({
      otpOptions: {
        sendOTP: async ({
          user,
          otp,
        }: {
          user: { email: string };
          otp: string;
        }) => {
          // Reuse the existing QStash client — publish to the same OTP email job
          // that the legacy login route uses (app/api/jobs/send-otp-email).
          const { qstash } = await import("@/lib/qeue/qstash");
          await qstash.publishJSON({
            url: `${process.env.APP_BASE_URL}/api/jobs/send-otp-email`,
            body: {
              email: user.email,
              otp,
            },
          });
        },
      },
    }),
  ],

  // Session uses DB (Prisma adapter) — no Redis required.
  session: {
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
