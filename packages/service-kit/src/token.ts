import { SignJWT, jwtVerify } from "jose";
import { ServiceTokenClaimsSchema, type ServiceTokenClaims } from "@stackable/contracts";
import { errors } from "./errors";

export const SERVICE_TOKEN_ISSUER = "stackable-gateway";
const MIN_SECRET_LENGTH = 32; // HS256 needs a key at least as long as its 256-bit hash
export const DEFAULT_TOKEN_TTL_SECONDS = 60; // short-lived so a leaked token is nearly useless

// A missing secret must stop the service, never fall back to a default.
function getSecret(): Uint8Array {
  const secret = process.env.SERVICE_TOKEN_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SERVICE_TOKEN_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`);
  }
  return new TextEncoder().encode(secret);
}

export interface SignTokenInput {
  audience: string;
  sub: string;
  schoolId: string;
  role?: string;
  ttlSeconds?: number;
}

/** Issues a service token for one actor and school; used by the gateway and by tests. */
export async function signServiceToken(input: SignTokenInput): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ schoolId: input.schoolId, ...(input.role ? { role: input.role } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(SERVICE_TOKEN_ISSUER)
    .setAudience(input.audience)
    .setSubject(input.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + (input.ttlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS))
    .sign(getSecret());
}

/** Returns the claims of a valid token for this audience; throws unauthorized otherwise. */
export async function verifyServiceToken(token: string, audience: string): Promise<ServiceTokenClaims> {
  const secret = getSecret();
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: SERVICE_TOKEN_ISSUER,
      audience,
    });
    return ServiceTokenClaimsSchema.parse(payload);
  } catch {
    throw errors.unauthorized("Invalid or expired service token");
  }
}
