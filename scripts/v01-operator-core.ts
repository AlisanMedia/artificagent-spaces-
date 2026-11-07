import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign,
  randomUUID,
} from "node:crypto";
import {
  mkdir,
  writeFile,
  readFile,
  lstat,
  realpath,
  access,
} from "node:fs/promises";
import { resolve, join, dirname, sep } from "node:path";
import { z } from "zod";
import { invariant } from "../src/domain/platform";
import { digest } from "../src/server/crypto";
import {
  readPrivateBinding,
  readPrivateBytes,
  readFalSecret,
  readApproverPublicKey,
} from "../src/server/v01/configuration";
import { V01Permit } from "../src/server/v01/authorization";
import { compileServiceProfile } from "../src/server/production/prompts";

export const APPROVED_SOURCE =
  "2c5829296c7453dbb1f28a5f3765bf868328e3b2fb5dd4fd2f15d0d38f81cfe0";
const ORIGINAL =
  "ce5e3861625e0ed33499526626db6360719c4af0d206ed574067f7710a0c4791";
const PROMPT =
  "73c2b37a81eeb066afd5f521b1e46eaceef4bc0d59a0f92c8bae34bdfe6e1fd1";
export const AUTHORIZATION_ID = "v581-owner-single-v01-test";
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Text = z.string().trim().min(3).max(160);
const Config = z
  .object({
    version: z.literal(1),
    operatorId: Text,
    approvalReference: Text,
    authorizationSha256: Hash,
    publicFingerprint: Hash,
    publicKeyFile: z.string(),
    falKeyFile: z.string().nullable(),
    runtimeRoot: z.string(),
    repositoryRoot: z.string(),
    identityVerification: z.literal(
      "operator-at-authenticated-terminal-not-verified-by-this-tool",
    ),
  })
  .strict();
export type OperatorConfig = z.infer<typeof Config>;
function inside(root: string, path: string) {
  return (
    resolve(path) === resolve(root) ||
    resolve(path).startsWith(resolve(root) + sep)
  );
}
export async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
async function outsideGit(path: string, repo: string) {
  invariant(
    !inside(repo, path),
    "V01_OPERATOR_MATERIAL_MUST_BE_OUTSIDE_APP",
    403,
  );
  let current = resolve(path);
  while (!(await exists(current))) current = dirname(current);
  current = await realpath(current);
  invariant(
    !inside(await realpath(repo), current),
    "V01_OPERATOR_MATERIAL_MUST_BE_OUTSIDE_APP",
    403,
  );
  while (true) {
    invariant(
      !(await exists(join(current, ".git"))),
      "V01_OPERATOR_MATERIAL_MUST_BE_OUTSIDE_GIT",
      403,
    );
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
async function privateDir(path: string, repo: string) {
  await outsideGit(path, repo);
  await mkdir(path, { recursive: true, mode: 0o700 });
  const stat = await lstat(path);
  invariant(
    stat.isDirectory() &&
      !stat.isSymbolicLink() &&
      (stat.mode & 0o077) === 0 &&
      stat.uid === process.getuid?.(),
    "V01_OPERATOR_DIRECTORY_PERMISSIONS",
    403,
  );
}
async function put(path: string, content: string) {
  await writeFile(path, content, { flag: "wx", mode: 0o600 });
}
export function publicFingerprint(pem: string) {
  return digest(createPublicKey(pem).export({ type: "spki", format: "der" }));
}
export async function approvedScope(repo: string) {
  const record = JSON.parse(
    await readFile(
      join(repo, "docs/v01-v581-owner-authorization.json"),
      "utf8",
    ),
  );
  const a = record.OWNER_AUTHORIZATION;
  invariant(
    a?.status === "APPROVED_CONDITIONAL" &&
      a.serviceId === "V01" &&
      a.model === "kling/v4/image-to-video" &&
      a.promptProfile === "video.natural.v1" &&
      a.source?.providerInputSha256 === APPROVED_SOURCE &&
      a.source?.originalSha256 === ORIGINAL &&
      a.maxBillableSubmits === 1 &&
      a.maxIncrementalCostMicroUsd === 10000000 &&
      a.durationSeconds === 4 &&
      a.aspectRatio === "16:9" &&
      a.width === 1920 &&
      a.height === 1080 &&
      a.automaticSecondSubmit === false &&
      a.paidModelFallback === false,
    "V01_OWNER_RECORD_SCOPE_DENIED",
    403,
  );
  const profile = compileServiceProfile("V01", {
    durationSeconds: 4,
    aspectRatio: "16:9",
  });
  invariant(
    profile.version === a.promptProfile &&
      profile.promptSha256 === PROMPT &&
      profile.promptSha256 === a.promptSha256 &&
      profile.profileSha256 === a.profileSha256,
    "V01_OWNER_PROMPT_DRIFT",
    409,
  );
  invariant(
    digest(await readFile(join(repo, a.source.originalPath))) === ORIGINAL,
    "V01_APPROVED_SOURCE_DRIFT",
    409,
  );
  return { sha256: digest(JSON.stringify(a)), promptSha256: PROMPT };
}
export async function operatorConfig(home: string) {
  const cfg = Config.parse(
    JSON.parse(readPrivateBinding(join(home, "app-config.json"))),
  );
  invariant(
    publicFingerprint(readPrivateBinding(cfg.publicKeyFile)) ===
      cfg.publicFingerprint,
    "V01_TRUST_FINGERPRINT_CHANGED",
    403,
  );
  invariant(
    (await approvedScope(cfg.repositoryRoot)).sha256 ===
      cfg.authorizationSha256,
    "V01_OWNER_RECORD_CHANGED",
    409,
  );
  return cfg;
}
/** Called only by a named operator after explicit setup approval and public-key fingerprint pinning. Never called by the app. */
export async function setupOperator(input: {
  home: string;
  repo: string;
  operatorId: string;
  approvalReference: string;
  approveKeySetup: boolean;
  falKey?: string;
  existingPrivateKey?: string;
  trustedPublicKey?: string;
  pinFingerprint: (fingerprint: string) => Promise<boolean>;
}) {
  const operatorId = Text.parse(input.operatorId),
    approvalReference = Text.parse(input.approvalReference);
  invariant(
    input.approveKeySetup,
    "V01_EXPLICIT_OPERATOR_SETUP_APPROVAL_REQUIRED",
    403,
  );
  const scope = await approvedScope(input.repo);
  await privateDir(input.home, input.repo);
  invariant(
    !(await exists(join(input.home, "app-config.json"))) &&
      !(await exists(join(input.home, "signer-config.json"))) &&
      !(await exists(join(input.home, "approver-private.pem"))),
    "V01_EXISTING_SETUP_MUST_NOT_BE_OVERWRITTEN",
    409,
  );
  invariant(
    !input.trustedPublicKey || input.existingPrivateKey,
    "V01_EXISTING_TRUST_REQUIRES_MATCHING_EXTERNAL_SIGNER",
    403,
  );
  if (input.existingPrivateKey)
    await outsideGit(input.existingPrivateKey, input.repo);
  const privateKey = input.existingPrivateKey
    ? createPrivateKey(readPrivateBinding(input.existingPrivateKey))
    : generateKeyPairSync("ed25519").privateKey;
  invariant(
    privateKey.asymmetricKeyType === "ed25519",
    "V01_SIGNER_KEY_TYPE_DENIED",
    403,
  );
  const publicPem = createPublicKey(privateKey)
    .export({ type: "spki", format: "pem" })
    .toString();
  const fingerprint = publicFingerprint(publicPem);
  invariant(
    !input.trustedPublicKey ||
      fingerprint === publicFingerprint(input.trustedPublicKey),
    "V01_EXISTING_TRUST_MISMATCH",
    403,
  );
  invariant(
    await input.pinFingerprint(fingerprint),
    "V01_MANUAL_TRUST_PIN_REQUIRED",
    403,
  );
  if (input.falKey !== undefined)
    invariant(
      input.falKey.length > 0 &&
        input.falKey.length <= 4096 &&
        input.falKey === input.falKey.trim() &&
        [...input.falKey].every(
          (char) => char.charCodeAt(0) >= 33 && char.charCodeAt(0) <= 126,
        ),
      "V01_SECRET_FORMAT_DENIED",
      403,
    );
  const privatePath =
    input.existingPrivateKey ?? join(input.home, "approver-private.pem");
  if (!input.existingPrivateKey)
    await put(
      privatePath,
      privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    );
  const publicPath = join(input.home, "approver-public.pem");
  await put(publicPath, publicPem);
  const falPath =
    input.falKey === undefined ? null : join(input.home, "fal.key");
  if (falPath) await put(falPath, input.falKey!);
  // Application configuration deliberately excludes the private signer path/material.
  const cfg: OperatorConfig = {
    version: 1,
    operatorId,
    approvalReference,
    authorizationSha256: scope.sha256,
    publicFingerprint: fingerprint,
    publicKeyFile: publicPath,
    falKeyFile: falPath,
    runtimeRoot: join(
      resolve(input.repo),
      ".spaces-local",
      "v01-approved-live",
    ),
    repositoryRoot: resolve(input.repo),
    identityVerification:
      "operator-at-authenticated-terminal-not-verified-by-this-tool",
  };
  await put(
    join(input.home, "signer-config.json"),
    JSON.stringify({
      privateKeyFile: privatePath,
      purpose: "operational-manually-pinned-not-offline-fixture",
      operatorId,
      approvalReference,
    }),
  );
  await put(join(input.home, "app-config.json"), JSON.stringify(cfg));
  return cfg;
}
export function applicationEnvironment(
  cfg: OperatorConfig,
  inherited: NodeJS.ProcessEnv,
) {
  invariant(
    !cfg.falKeyFile ||
      (!inherited["FAL_KEY"] &&
        (!inherited["FAL_KEY_FILE"] ||
          inherited["FAL_KEY_FILE"] === cfg.falKeyFile)),
    "V01_AMBIGUOUS_SECRET_BINDING",
    403,
  );
  const inheritedTrust = readApproverPublicKey(inherited);
  invariant(
    !inheritedTrust ||
      publicFingerprint(inheritedTrust) === cfg.publicFingerprint,
    "V01_EXISTING_TRUST_MISMATCH",
    403,
  );
  const env: NodeJS.ProcessEnv = {
    ...inherited,
    SPACES_LOCAL_DATA_DIR: cfg.runtimeRoot,
    SPACES_V01_APPROVER_PUBLIC_KEY_FILE: cfg.publicKeyFile,
  };
  delete env["SPACES_V01_APPROVER_PUBLIC_KEY"];
  delete env["SPACES_V01_OPERATOR_HOME"];
  delete env["SPACES_V01_SIGNER_PRIVATE_KEY"];
  delete env["SPACES_V01_SIGNER_PRIVATE_KEY_FILE"];
  if (cfg.falKeyFile) env["FAL_KEY_FILE"] = cfg.falKeyFile;
  return env;
}
const Artifact = z.object({ file: z.string().min(1), sha256: Hash }).strict();
const Decision = z
  .object({
    state: z.enum(["VERIFIED", "NOT_VERIFIED", "DENIED"]),
    artifact: Artifact,
  })
  .strict();
export const OperationalEvidence = z
  .object({
    version: z.literal("v581-operator-evidence-v1"),
    authorizationSha256: Hash,
    accountReferenceSha256: Hash,
    verifiedByOperator: Text,
    reviewedAtMs: z.number().int(),
    expiresAtMs: z.number().int(),
    sourceSha256: Hash,
    model: z.literal("kling/v4/image-to-video"),
    access: Decision.extend({
      method: z.enum([
        "fal-support-confirmation",
        "authenticated-model-access-controls",
      ]),
    }),
    rights: Decision.extend({
      syntheticSourceTransferAndRetentionApproved: z.boolean(),
    }),
    billing: Decision.extend({
      unitPriceMicroUsdPerSecond: z.number().int().positive().nullable(),
      maximumAdditionalLiabilityMicroUsd: z
        .number()
        .int()
        .positive()
        .nullable(),
      newPurchaseMicroUsd: z.number().int().nonnegative().nullable(),
      includesTaxFeesAndPartnerRetries: z.boolean(),
      providerRetryAndFallbackConstraintsReviewed: z.boolean(),
    }),
  })
  .strict();
export async function validateEvidence(
  cfg: OperatorConfig,
  input: unknown,
  now = Date.now(),
) {
  const e = OperationalEvidence.parse(input);
  invariant(
    e.authorizationSha256 === cfg.authorizationSha256 &&
      e.verifiedByOperator === cfg.operatorId &&
      e.sourceSha256 === APPROVED_SOURCE &&
      e.reviewedAtMs <= now &&
      e.expiresAtMs > now &&
      now - e.reviewedAtMs <= 86400000 &&
      e.expiresAtMs - e.reviewedAtMs <= 86400000,
    "V01_EVIDENCE_SCOPE_OR_AGE_DENIED",
    403,
  );
  for (const decision of [e.access, e.rights, e.billing]) {
    invariant(
      decision.state === "VERIFIED",
      "V01_VERIFIED_ACCOUNT_RIGHTS_BILLING_REQUIRED",
      403,
    );
    await outsideGit(decision.artifact.file, cfg.repositoryRoot);
    invariant(
      digest(readPrivateBytes(decision.artifact.file, 1048576)) ===
        decision.artifact.sha256,
      "V01_EVIDENCE_ARTIFACT_CHANGED",
      403,
    );
  }
  invariant(
    e.rights.syntheticSourceTransferAndRetentionApproved &&
      e.billing.includesTaxFeesAndPartnerRetries &&
      e.billing.providerRetryAndFallbackConstraintsReviewed &&
      e.billing.newPurchaseMicroUsd === 0 &&
      e.billing.unitPriceMicroUsdPerSecond !== null &&
      e.billing.maximumAdditionalLiabilityMicroUsd !== null &&
      e.billing.maximumAdditionalLiabilityMicroUsd <= 10000000 &&
      e.billing.unitPriceMicroUsdPerSecond * 4 <=
        e.billing.maximumAdditionalLiabilityMicroUsd,
    "V01_TOTAL_LIABILITY_NOT_PROVEN_WITHIN_USD10",
    403,
  );
  return e;
}
export const SourceBinding = z
  .object({
    organizationId: z.literal("studio"),
    propertyId: z.string(),
    revision: z.number().int().positive(),
    assetId: z.string(),
    sourceSha256: z.literal(APPROVED_SOURCE),
    authorizationSha256: Hash,
  })
  .strict();
/** One issuance per persistent operator authorization; never refreshes/overwrites an issued permit or creates a replacement paid task. */
export async function issuePermit(
  home: string,
  evidence: unknown,
  now = Date.now(),
) {
  const cfg = await operatorConfig(home);
  const e = await validateEvidence(cfg, evidence, now);
  readFalSecret(applicationEnvironment(cfg, process.env));
  const binding = SourceBinding.parse(
    JSON.parse(
      readPrivateBinding(join(cfg.runtimeRoot, "v01-source-binding.json")),
    ),
  );
  invariant(
    binding.authorizationSha256 === cfg.authorizationSha256,
    "V01_SOURCE_AUTHORIZATION_CHANGED",
    403,
  );
  const marker = join(home, "issued-once.json");
  invariant(
    !(await exists(marker)) &&
      !(await exists(join(cfg.runtimeRoot, "v01-owner-test-permit.json"))),
    "V01_ALREADY_ISSUED_RESUME_OR_RECONCILE_NO_REISSUE",
    409,
  );
  const signer = z
    .object({
      privateKeyFile: z.string(),
      purpose: z.literal("operational-manually-pinned-not-offline-fixture"),
      operatorId: Text,
      approvalReference: Text,
    })
    .strict()
    .parse(JSON.parse(readPrivateBinding(join(home, "signer-config.json"))));
  invariant(
    signer.operatorId === cfg.operatorId &&
      signer.approvalReference === cfg.approvalReference,
    "V01_SIGNER_OPERATOR_SCOPE_DENIED",
    403,
  );
  await outsideGit(signer.privateKeyFile, cfg.repositoryRoot);
  const key = createPrivateKey(readPrivateBinding(signer.privateKeyFile));
  invariant(
    publicFingerprint(
      createPublicKey(key).export({ type: "spki", format: "pem" }).toString(),
    ) === cfg.publicFingerprint,
    "V01_SIGNER_TRUST_MISMATCH",
    403,
  );
  const permit = V01Permit.parse({
    version: "v01-owner-test-v1",
    id: AUTHORIZATION_ID,
    mode: "fal-live-test",
    organizationId: binding.organizationId,
    propertyId: binding.propertyId,
    revision: binding.revision,
    sourceSha256: APPROVED_SOURCE,
    serviceId: "V01",
    model: "kling/v4/image-to-video",
    profile: "v01-provider-1080p-v1",
    durationSeconds: 4,
    aspectRatio: "16:9",
    maxRequests: 1,
    maxPolls: 60,
    pollIntervalMs: 5000,
    issuedAtMs: now - 1000,
    expiresAtMs: Math.min(now + 900000, e.expiresAtMs),
    submitWithinMs: 120000,
    maxJobWallMs: 900000,
    maxSourceBytes: 5242880,
    maxOutputBytes: 52428800,
    unitPriceMicroUsdPerSecond: e.billing.unitPriceMicroUsdPerSecond,
    perRequestCapMicroUsd: e.billing.maximumAdditionalLiabilityMicroUsd,
    totalCapMicroUsd: e.billing.maximumAdditionalLiabilityMicroUsd,
    priceEvidenceSha256: e.billing.artifact.sha256,
    accountAccessVerified: true,
    syntheticOwnedSourceOnly: true,
    rightsAndRetentionApproved: true,
    providerHardCapAndOverageReviewed: true,
    transferMethod: "inline-base64-request-only",
    fixtureOutputSha256: null,
  });
  const payload = Buffer.from(JSON.stringify(permit)),
    signature = sign(null, payload, key).toString("hex");
  // Durable marker precedes publication. A crash may conservatively block issuance; it never creates a second submission allowance.
  await put(
    marker,
    JSON.stringify({
      authorizationId: AUTHORIZATION_ID,
      authorizationSha256: cfg.authorizationSha256,
      permitSha256: digest(payload),
      nonce: randomUUID(),
      issuedAtMs: now,
    }),
  );
  await put(
    join(cfg.runtimeRoot, "v01-owner-test-permit.json"),
    JSON.stringify({ payload: payload.toString("base64url"), signature }),
  );
  return {
    status: "CONFIGURED" as const,
    permitId: AUTHORIZATION_ID,
    expiresAtMs: permit.expiresAtMs,
  };
}
