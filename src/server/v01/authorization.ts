import { createPublicKey, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { Id, invariant } from "@/domain/platform";
import { digest } from "../crypto";

export const V01_MODEL = "kling/v4/image-to-video" as const;
export const V01_PROFILE = "v01-provider-1080p-v1" as const;
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const V01Permit = z
  .object({
    version: z.literal("v01-owner-test-v1"),
    id: Id,
    mode: z.enum(["offline-fixture", "fal-live-test"]),
    organizationId: Id,
    propertyId: Id,
    revision: z.number().int().positive(),
    sourceSha256: Hash,
    serviceId: z.literal("V01"),
    model: z.literal(V01_MODEL),
    profile: z.literal(V01_PROFILE),
    durationSeconds: z.union([z.literal(4), z.literal(8)]),
    aspectRatio: z.enum(["16:9", "9:16"]),
    maxRequests: z.number().int().min(1).max(3),
    maxPolls: z.number().int().min(4).max(60),
    pollIntervalMs: z.number().int().min(0).max(30_000),
    issuedAtMs: z.number().int().positive(),
    expiresAtMs: z.number().int().positive(),
    submitWithinMs: z.number().int().min(1000).max(120_000),
    maxJobWallMs: z.number().int().min(1000).max(900_000),
    maxSourceBytes: z.number().int().min(100).max(5_242_880),
    maxOutputBytes: z.number().int().min(1000).max(52_428_800),
    unitPriceMicroUsdPerSecond: z.number().int().min(0).max(100_000_000),
    perRequestCapMicroUsd: z.number().int().min(0).max(1_000_000_000),
    totalCapMicroUsd: z.number().int().min(0).max(3_000_000_000),
    priceEvidenceSha256: Hash,
    accountAccessVerified: z.boolean(),
    syntheticOwnedSourceOnly: z.literal(true),
    rightsAndRetentionApproved: z.boolean(),
    providerHardCapAndOverageReviewed: z.boolean(),
    transferMethod: z.literal("inline-base64-request-only"),
    fixtureOutputSha256: Hash.nullable(),
  })
  .strict();
export type V01Permit = z.infer<typeof V01Permit>;
export interface V01Authority {
  load(nowMs: number): Promise<{ permit: V01Permit; payloadSha256: string }>;
  verifyReconciliation?(
    scope: {
      jobId: string;
      requestId: string;
      organizationId: string;
      sourceSha256: string;
      providerId: string;
    },
    nowMs: number,
  ): Promise<void>;
}
/** Trusted server configuration supplies the approver public key; the browser has no permit-creation API. */
export class FileV01Authority implements V01Authority {
  constructor(
    readonly privateRoot: string,
    readonly trustedPublicKey: () => string | undefined,
  ) {}
  async load(nowMs: number) {
    const publicKey = this.trustedPublicKey();
    invariant(publicKey, "V01_OWNER_TEST_PERMISSION_REQUIRED", 403);
    let bytes: Buffer;
    try {
      bytes = await readFile(
        join(this.privateRoot, "v01-owner-test-permit.json"),
      );
    } catch {
      throw new Error("V01_OWNER_TEST_PERMISSION_REQUIRED");
    }
    invariant(bytes.length <= 16_384, "V01_PERMIT_INVALID", 403);
    const signed = z
      .object({
        payload: z.string().max(12_000),
        signature: z.string().regex(/^[a-f0-9]{128}$/),
      })
      .strict()
      .parse(JSON.parse(bytes.toString()));
    const payload = Buffer.from(signed.payload, "base64url");
    const key = createPublicKey(publicKey);
    invariant(
      key.asymmetricKeyType === "ed25519" &&
        verify(null, payload, key, Buffer.from(signed.signature, "hex")),
      "V01_PERMIT_SIGNATURE_INVALID",
      403,
    );
    const permit = V01Permit.parse(JSON.parse(payload.toString()));
    invariant(
      permit.issuedAtMs <= nowMs &&
        permit.expiresAtMs > nowMs &&
        permit.expiresAtMs - permit.issuedAtMs <= 3_600_000,
      "V01_PERMIT_EXPIRED",
      403,
    );
    invariant(
      permit.mode === "offline-fixture" ||
        (permit.accountAccessVerified &&
          permit.rightsAndRetentionApproved &&
          permit.providerHardCapAndOverageReviewed),
      "V01_LIVE_ACCOUNT_RIGHTS_AND_BILLING_GATES_REQUIRED",
      403,
    );
    const price = permit.durationSeconds * permit.unitPriceMicroUsdPerSecond;
    invariant(
      price <= permit.perRequestCapMicroUsd &&
        permit.perRequestCapMicroUsd <= permit.totalCapMicroUsd,
      "V01_PRICE_CAP_INVALID",
      403,
    );
    invariant(
      permit.mode === "offline-fixture"
        ? permit.totalCapMicroUsd === 0 && price === 0
        : price > 0 && permit.pollIntervalMs >= 5000,
      "V01_PRICE_OR_POLL_POLICY_REQUIRED",
      403,
    );
    return { permit, payloadSha256: digest(payload) };
  }
  async verifyReconciliation(
    scope: {
      jobId: string;
      requestId: string;
      organizationId: string;
      sourceSha256: string;
      providerId: string;
    },
    nowMs: number,
  ) {
    const key = this.trustedPublicKey();
    invariant(key, "V01_RECONCILIATION_PROOF_REQUIRED", 403);
    const b = await readFile(
      join(this.privateRoot, "v01-reconciliation-proof.json"),
    );
    invariant(b.length <= 16_384, "V01_RECONCILIATION_PROOF_REQUIRED", 403);
    const envelope = z
      .object({
        payload: z.string().max(12_000),
        signature: z.string().regex(/^[a-f0-9]{128}$/),
      })
      .strict()
      .parse(JSON.parse(b.toString()));
    const payload = Buffer.from(envelope.payload, "base64url");
    invariant(
      verify(
        null,
        payload,
        createPublicKey(key),
        Buffer.from(envelope.signature, "hex"),
      ),
      "V01_RECONCILIATION_PROOF_REQUIRED",
      403,
    );
    const proof = z
      .object({
        version: z.literal("v01-reconciliation-v1"),
        jobId: Id,
        requestId: Id,
        organizationId: Id,
        sourceSha256: Hash,
        providerId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
        accountEvidenceSha256: Hash,
        expiresAtMs: z.number().int(),
        issuedAtMs: z.number().int(),
      })
      .strict()
      .parse(JSON.parse(payload.toString()));
    invariant(
      Object.entries(scope).every(
        ([k, v]) => proof[k as keyof typeof proof] === v,
      ) &&
        proof.issuedAtMs <= nowMs &&
        proof.expiresAtMs > nowMs &&
        proof.expiresAtMs - proof.issuedAtMs <= 300_000,
      "V01_RECONCILIATION_PROOF_SCOPE_DENIED",
      403,
    );
  }
}
