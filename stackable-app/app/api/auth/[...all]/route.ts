// Better Auth catch-all handler — only active when AUTH_PROVIDER=betterauth.
// When AUTH_PROVIDER=legacy, this file exists but the legacy routes (login,
// verify-otp, logout, resend-otp) handle all auth traffic; Better Auth's
// endpoints simply go unused.

import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
