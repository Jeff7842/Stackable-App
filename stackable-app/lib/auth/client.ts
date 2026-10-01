// Better Auth browser client — only import this in client components.
// Never import this in server components or API routes (use auth from auth.ts).
import { createAuthClient } from "better-auth/react";
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [twoFactorClient(), emailOTPClient()],
});

export type { Session } from "@/lib/auth/auth";
