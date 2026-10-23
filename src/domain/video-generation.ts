import { z } from "zod";
import { Id, invariant, microUsd } from "./platform";
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const ShotIntent = z
  .object({
    organizationId: Id,
    propertyId: Id,
    revision: z.number().int().positive(),
    manifestSha256: Hash,
    idempotencyKey: z.string().min(8).max(80),
    epoch: z.number().int().nonnegative(),
    modelId: z.string().min(1).max(80),
    modelRevision: z.string().min(1).max(80),
    mode: z.enum(["pov", "cinematic", "hybrid"]),
    aspect: z.enum(["16:9", "9:16"]),
    resolution: z.enum(["360p", "720p", "1080p"]),
    durationSeconds: z.number().int().min(2).max(30),
    references: z
      .array(
        z
          .object({
            evidenceId: Id,
            sha256: Hash,
            kind: z.enum(["image", "video"]),
            seconds: z.number().min(0).max(30),
            truth: z.enum(["E0", "E1", "E2"]),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    camera: z
      .object({
        view: z.enum(["first-person-eye-level", "composed"]),
        eyeHeightMeters: z.number().min(1.4).max(1.9),
        roomIds: z.array(Id).max(30),
        pathPolicy: z.literal("CONFIRMED_REGIONS_ONLY"),
      })
      .strict(),
    consistency: z
      .object({
        forbiddenClaims: z.array(z.string().min(1).max(100)).min(1).max(30),
        preserveSourceFeatures: z.literal(true),
        inventUnknownLayout: z.literal(false),
      })
      .strict(),
    rights: z
      .object({
        ownedOrLicensed: z.literal(true),
        syntheticOnly: z.literal(true),
        moderation: z.literal("LOCAL_SYNTHETIC_CLEARED"),
        publicationAllowed: z.literal(false),
      })
      .strict(),
    maxCostMicroUsd: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export type ShotIntentValue = z.infer<typeof ShotIntent>;
export interface ApprovedShotScope {
  readonly organizationId: string;
  readonly propertyId: string;
  readonly revision: number;
  readonly manifestSha256: string;
  readonly epoch: number;
  readonly references: ShotIntentValue["references"];
  readonly roomIds: readonly string[];
  readonly forbiddenClaims: readonly string[];
}
export interface GenerationCapabilities {
  readonly modelId: string;
  readonly revision: string;
  readonly local: boolean;
  readonly enabled: boolean;
  readonly kinds: readonly ("image" | "video")[];
  readonly resolutions: readonly ("360p" | "720p" | "1080p")[];
  readonly aspects: readonly ("16:9" | "9:16")[];
  readonly minSeconds: number;
  readonly maxSeconds: number;
  readonly tariff: {
    outputSecondMicroUsd: number;
    inputVideoSecondMicroUsd: number;
    minimumMicroUsd: number;
    verifiedSource: string;
  } | null;
}
export function validateShotScope(
  input: unknown,
  scope: ApprovedShotScope,
  cap: GenerationCapabilities,
): ShotIntentValue {
  const shot = ShotIntent.parse(input);
  invariant(
    shot.organizationId === scope.organizationId &&
      shot.propertyId === scope.propertyId,
    "PROVIDER_TENANT_PROPERTY_SCOPE_DENIED",
    403,
  );
  invariant(
    shot.revision === scope.revision &&
      shot.manifestSha256 === scope.manifestSha256,
    "STALE_PROVIDER_SOURCE",
    409,
  );
  invariant(shot.epoch === scope.epoch, "PROVIDER_CANCEL_FENCE", 409);
  invariant(
    shot.modelId === cap.modelId && shot.modelRevision === cap.revision,
    "UNSUPPORTED_MODEL_REVISION",
    409,
  );
  invariant(
    cap.aspects.includes(shot.aspect) &&
      cap.resolutions.includes(shot.resolution) &&
      shot.durationSeconds >= cap.minSeconds &&
      shot.durationSeconds <= cap.maxSeconds,
    "UNSUPPORTED_MODEL_CAPABILITY",
    409,
  );
  invariant(
    new Set(shot.references.map((r) => r.evidenceId)).size ===
      shot.references.length &&
      shot.references.every(
        (r) =>
          cap.kinds.includes(r.kind) &&
          scope.references.some((s) => JSON.stringify(s) === JSON.stringify(r)),
      ),
    "PROVIDER_EVIDENCE_SCOPE_DENIED",
    403,
  );
  invariant(
    shot.camera.roomIds.every((r) => scope.roomIds.includes(r)) &&
      scope.forbiddenClaims.every((c) =>
        shot.consistency.forbiddenClaims.includes(c),
      ),
    "UNSUPPORTED_OR_UNSAFE_SHOT_PLAN",
    409,
  );
  invariant(
    shot.mode !== "pov" || shot.camera.view === "first-person-eye-level",
    "FIRST_PERSON_REQUIRED",
    409,
  );
  return shot;
}
export function shotCostBound(
  shot: ShotIntentValue,
  cap: GenerationCapabilities,
) {
  invariant(cap.tariff, "PROVIDER_PRICE_NOT_VERIFIED", 409);
  const t = cap.tariff;
  [
    t.outputSecondMicroUsd,
    t.inputVideoSecondMicroUsd,
    t.minimumMicroUsd,
  ].forEach(microUsd);
  const total = Math.max(
    t.minimumMicroUsd,
    Math.ceil(
      shot.durationSeconds * t.outputSecondMicroUsd +
        shot.references.reduce(
          (n, r) => n + (r.kind === "video" ? r.seconds : 0),
          0,
        ) *
          t.inputVideoSecondMicroUsd,
    ),
  );
  microUsd(total);
  invariant(total <= shot.maxCostMicroUsd, "PROVIDER_SPEND_CAP_EXCEEDED", 402);
  return total;
}
export interface GeneratedShotArtifact {
  readonly organizationId: string;
  readonly propertyId: string;
  readonly revision: number;
  readonly manifestSha256: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly codec: "h264";
  readonly mime: "video/mp4";
  readonly durationSeconds: number;
  readonly referenceHashes: readonly string[];
  readonly synthetic: true;
  readonly disclosure: "SYNTHETIC_LOCAL_SOURCE_MOTION_NOT_GENERATIVE";
  readonly hallucinationGuarantee: "NONE_HUMAN_REVIEW_REQUIRED";
  readonly billedMicroUsd: number;
}
export function validateGeneratedShot(
  artifact: GeneratedShotArtifact,
  shot: ShotIntentValue,
  reserved: number,
) {
  invariant(
    artifact.organizationId === shot.organizationId &&
      artifact.propertyId === shot.propertyId &&
      artifact.revision === shot.revision &&
      artifact.manifestSha256 === shot.manifestSha256,
    "GENERATED_SCOPE_MISMATCH",
    403,
  );
  invariant(
    artifact.synthetic === true &&
      artifact.disclosure === "SYNTHETIC_LOCAL_SOURCE_MOTION_NOT_GENERATIVE" &&
      artifact.hallucinationGuarantee === "NONE_HUMAN_REVIEW_REQUIRED",
    "MISLEADING_GENERATION_CLAIM",
    409,
  );
  invariant(
    artifact.mime === "video/mp4" &&
      artifact.codec === "h264" &&
      Hash.safeParse(artifact.sha256).success &&
      Number.isSafeInteger(artifact.bytes) &&
      artifact.bytes > 0 &&
      artifact.bytes <= 52_428_800 &&
      Math.abs(artifact.durationSeconds - shot.durationSeconds) < 0.15,
    "GENERATED_ARTIFACT_NOT_VERIFIED",
    409,
  );
  invariant(
    JSON.stringify(artifact.referenceHashes) ===
      JSON.stringify(shot.references.map((r) => r.sha256)),
    "GENERATED_PROVENANCE_MISMATCH",
    409,
  );
  invariant(
    microUsd(artifact.billedMicroUsd) <= reserved,
    "UNRECONCILED_PROVIDER_OVERSPEND",
    409,
  );
}
