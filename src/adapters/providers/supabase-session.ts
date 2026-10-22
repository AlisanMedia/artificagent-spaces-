import { jwtVerify, type JWTVerifyGetKey } from "jose";
import { invariant } from "@/domain/platform";

/** Offline-testable JWT boundary. No cloud client/JWKS request or hosted session activation. */
export async function verifySupabaseSession(
  token: string,
  trustedKey: Uint8Array | CryptoKey | JWTVerifyGetKey,
  issuer: string,
  now = new Date(),
) {
  const options = {
    issuer,
    audience: "authenticated",
    algorithms: ["ES256", "RS256"],
    currentDate: now,
  };
  const verified =
    typeof trustedKey === "function"
      ? await jwtVerify(token, trustedKey, options)
      : await jwtVerify(token, trustedKey, options);
  invariant(
    typeof verified.payload.sub === "string" &&
      verified.payload.sub.length > 0 &&
      verified.payload["role"] === "authenticated" &&
      typeof verified.payload.exp === "number",
    "INVALID_AUTH_SESSION",
    401,
  );
  // Tenant/role claims from client JWT metadata are NOT trusted. Resolve membership server-side.
  return {
    userId: verified.payload.sub,
    expiresAt: verified.payload.exp * 1000,
    organizationId: null,
    membershipMustBeResolved: true as const,
    hostedIntegrationEnabled: false as const,
  };
}
