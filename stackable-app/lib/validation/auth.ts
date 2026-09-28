// =============================================================================
// Password rules + auth request schemas.
// -----------------------------------------------------------------------------
// One source of truth: the forgot-password page uses PASSWORD_RULES to draw the
// checklist and strength bar, and the API uses the same rules to accept or reject.
// =============================================================================

import { z } from "zod";
import { emailSchema } from "./shared";

export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters — the pass mark", test: (p: string) => p.length >= 8 },
  { id: "lower", label: "A lowercase letter (a–z) — start with the basics", test: (p: string) => /[a-z]/.test(p) },
  { id: "upper", label: "An uppercase letter (A–Z) — capitals for a proper heading", test: (p: string) => /[A-Z]/.test(p) },
  { id: "number", label: "A number (0–9) — show your working", test: (p: string) => /\d/.test(p) },
  { id: "special", label: "A special character (!@#$…) — the extra credit", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

/** Index = how many rules pass (0–5). */
export const PASSWORD_LEVELS = [
  "Not started",
  "Needs revision",
  "Pass mark",
  "Merit",
  "Distinction",
  "Top of the class",
] as const;

export const passwordScore = (password: string) => PASSWORD_RULES.filter((r) => r.test(password)).length;

// max(72): bcrypt only reads the first 72 bytes, so longer input adds nothing.
export const passwordSchema = z
  .string()
  .max(72, "Use 72 characters or fewer.")
  .refine((p) => PASSWORD_RULES.every((r) => r.test(p)), "Your password doesn't meet all the requirements.");

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const verifyResetCodeSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });
