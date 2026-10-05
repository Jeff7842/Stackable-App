import { z } from "zod";

/** Body every service returns on failure; clients branch on `code`, never on `error`. */
export const ErrorEnvelopeSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.record(z.string(), z.unknown()),
  requestId: z.string(),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

/** Claims of the short-lived HS256 token the gateway sends to services. */
export const ServiceTokenClaimsSchema = z.object({
  iss: z.string().min(1),
  aud: z.string().min(1),
  sub: z.string().min(1),
  schoolId: z.string().min(1),
  role: z.string().min(1).optional(),
  exp: z.number().int(),
});
export type ServiceTokenClaims = z.infer<typeof ServiceTokenClaimsSchema>;

export const MeResponseSchema = z.object({
  userId: z.string(),
  schoolId: z.string(),
  role: z.string().nullable(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;
