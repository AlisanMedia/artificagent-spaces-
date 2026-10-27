import { createHash, createPublicKey, verify } from "node:crypto";
import { z } from "zod";
import { invariant } from "@/domain/platform";

const PublicKey = z
  .object({
    kty: z.literal("OKP"),
    crv: z.literal("Ed25519"),
    x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    kid: z.string().max(120).optional(),
    alg: z.literal("EdDSA").optional(),
    use: z.literal("sig").optional(),
  })
  .strict();
export const FAL_WEBHOOK_VERIFICATION_SOURCE =
  "https://fal.ai/docs/documentation/model-apis/inference/webhooks";
/** Offline verification only; keys must be obtained by the future server from the official JWKS with bounded caching. No key/network/credential fetch here. */
export function verifyFalWebhook(
  body: Uint8Array,
  headers: Headers,
  expected: { requestId: string; providerUserId: string },
  trusted: { fetchedAtMs: number; keys: readonly unknown[] },
  nowMs: number,
) {
  invariant(
    body.byteLength > 0 && body.byteLength <= 1_048_576,
    "PROVIDER_WEBHOOK_BODY_LIMIT",
    413,
  );
  const requestId = headers.get("x-fal-webhook-request-id"),
    userId = headers.get("x-fal-webhook-user-id"),
    timestamp = headers.get("x-fal-webhook-timestamp"),
    signature = headers.get("x-fal-webhook-signature");
  invariant(
    requestId === expected.requestId &&
      userId === expected.providerUserId &&
      timestamp &&
      /^\d{1,12}$/.test(timestamp) &&
      signature &&
      /^[a-f0-9]{128}$/i.test(signature),
    "PROVIDER_WEBHOOK_SIGNATURE_INVALID",
    403,
  );
  invariant(
    Math.abs(nowMs / 1000 - Number(timestamp)) <= 300 &&
      trusted.fetchedAtMs <= nowMs &&
      nowMs - trusted.fetchedAtMs <= 86_400_000 &&
      trusted.keys.length >= 1 &&
      trusted.keys.length <= 8,
    "PROVIDER_WEBHOOK_EXPIRED",
    403,
  );
  const message = Buffer.from(
    [
      requestId,
      userId,
      timestamp,
      createHash("sha256").update(body).digest("hex"),
    ].join("\n"),
  );
  const valid = trusted.keys.some((raw) => {
    const key = PublicKey.safeParse(raw);
    if (!key.success) return false;
    try {
      return verify(
        null,
        message,
        createPublicKey({ key: key.data, format: "jwk" }),
        Buffer.from(signature, "hex"),
      );
    } catch {
      return false;
    }
  });
  invariant(valid, "PROVIDER_WEBHOOK_SIGNATURE_INVALID", 403);
  const event = z
    .object({
      request_id: z.string(),
      status: z.enum(["OK", "ERROR"]),
      payload: z.unknown().optional(),
      error: z.unknown().optional(),
    })
    .strip()
    .parse(JSON.parse(new TextDecoder().decode(body)));
  invariant(
    event.request_id === expected.requestId,
    "PROVIDER_TASK_SCOPE_DENIED",
    403,
  );
  return {
    ...event,
    bodySha256: createHash("sha256").update(body).digest("hex"),
    authenticated: true as const,
  };
}
