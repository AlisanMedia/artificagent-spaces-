import { createPublicKey, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { Id, invariant } from "@/domain/platform";
import { digest } from "../crypto";

/** Local demo identities alone cannot approve a REAL provider artifact. Future independently provisioned reviewer signature is required. */
export async function verifyV01HumanReview(
  root: string,
  expected: {
    jobId: string;
    organizationId: string;
    propertyId: string;
    revision: number;
    reviewerId: string;
    creatorId: string;
    sourceSha256: string;
    outputSha256: string;
  },
  reviewerPublicKey: string | undefined,
  ownerPublicKey: string | undefined,
  nowMs = Date.now(),
) {
  invariant(
    reviewerPublicKey &&
      ownerPublicKey &&
      expected.reviewerId !== expected.creatorId,
    "V01_REAL_REVIEWER_PROOF_REQUIRED",
    403,
  );
  const reviewerKey = createPublicKey(reviewerPublicKey),
    ownerKey = createPublicKey(ownerPublicKey);
  invariant(
    reviewerKey.asymmetricKeyType === "ed25519" &&
      !reviewerKey
        .export({ type: "spki", format: "der" })
        .equals(ownerKey.export({ type: "spki", format: "der" })),
    "V01_DISTINCT_REVIEWER_KEY_REQUIRED",
    403,
  );
  const b = await readFile(
    join(root, "v01-human-reviews", Id.parse(expected.jobId) + ".json"),
  );
  invariant(b.length <= 16_384, "V01_REAL_REVIEWER_PROOF_REQUIRED", 403);
  const envelope = z
    .object({
      payload: z.string().max(12_000),
      signature: z.string().regex(/^[a-f0-9]{128}$/),
    })
    .strict()
    .parse(JSON.parse(b.toString()));
  const payload = Buffer.from(envelope.payload, "base64url");
  invariant(
    verify(null, payload, reviewerKey, Buffer.from(envelope.signature, "hex")),
    "V01_REVIEWER_SIGNATURE_INVALID",
    403,
  );
  const proof = z
    .object({
      version: z.literal("v01-independent-human-review-v1"),
      jobId: Id,
      organizationId: Id,
      propertyId: Id,
      revision: z.number().int(),
      reviewerId: Id,
      creatorId: Id,
      sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
      outputSha256: z.string().regex(/^[a-f0-9]{64}$/),
      independentHumanReview: z.literal(true),
      issuedAtMs: z.number().int(),
      expiresAtMs: z.number().int(),
    })
    .strict()
    .parse(JSON.parse(payload.toString()));
  invariant(
    Object.entries(expected).every(
      ([k, v]) => proof[k as keyof typeof proof] === v,
    ) &&
      proof.issuedAtMs <= nowMs &&
      proof.expiresAtMs > nowMs &&
      proof.expiresAtMs - proof.issuedAtMs <= 600_000,
    "V01_REVIEWER_PROOF_SCOPE_DENIED",
    403,
  );
  return digest(payload);
}
