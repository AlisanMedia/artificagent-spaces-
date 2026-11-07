// @vitest-environment node
// Ephemeral signing fixtures only: these keys/evidence NEVER authorize an actual provider request.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  rm,
  chmod,
  symlink,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateKeyPairSync } from "node:crypto";
import { digest } from "@/server/crypto";
import { FileV01Authority } from "@/server/v01/authorization";
import {
  readApproverPublicKey,
  readFalSecret,
  readPrivateBytes,
  falSecretStatus,
} from "@/server/v01/configuration";
import {
  APPROVED_SOURCE,
  AUTHORIZATION_ID,
  approvedScope,
  applicationEnvironment,
  exists,
  issuePermit,
  operatorConfig,
  setupOperator,
  validateEvidence,
  type OperatorConfig,
} from "../../scripts/v01-operator-core";
import { operatorMain } from "../../scripts/v01-operator";

let root: string, repo: string, home: string;
const fixtureSecret = "offline-placeholder-no-provider-access";
const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "spaces-v01-operator-test-"));
  repo = join(root, "app-fixture");
  home = join(root, "operator-fixture");
  await mkdir(join(repo, "docs"), { recursive: true });
  await mkdir(join(repo, "public/golden-v5"), { recursive: true });
  for (const path of [
    "docs/v01-v581-owner-authorization.json",
    "public/golden-v5/living.png",
  ])
    await copyFile(join(process.cwd(), path), join(repo, path));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});
async function setup(
  overrides: Partial<Parameters<typeof setupOperator>[0]> = {},
) {
  return setupOperator({
    repo,
    home,
    operatorId: "TEST-ONLY-named-operator",
    approvalReference: "TEST-ONLY-explicit-setup-consent-not-live-owner-proof",
    approveKeySetup: true,
    falKey: fixtureSecret,
    pinFingerprint: async () => true,
    ...overrides,
  });
}
async function evidence(cfg: OperatorConfig) {
  const file = join(home, "TEST-ONLY-account-rights-cost.txt");
  const bytes = Buffer.from(
    "Synthetic unit-test attestation. NOT a provider/account/legal or operational confirmation.",
  );
  await writeFile(file, bytes, { mode: 0o600 });
  const artifact = { file, sha256: digest(bytes) },
    now = Date.now();
  return {
    version: "v581-operator-evidence-v1" as const,
    authorizationSha256: cfg.authorizationSha256,
    accountReferenceSha256: digest("TEST-ONLY-account"),
    verifiedByOperator: cfg.operatorId,
    reviewedAtMs: now - 1000,
    expiresAtMs: now + 1200000,
    sourceSha256: APPROVED_SOURCE,
    model: "kling/v4/image-to-video" as const,
    access: {
      state: "VERIFIED" as const,
      method: "fal-support-confirmation" as const,
      artifact,
    },
    rights: {
      state: "VERIFIED" as const,
      syntheticSourceTransferAndRetentionApproved: true,
      artifact,
    },
    billing: {
      state: "VERIFIED" as const,
      artifact,
      unitPriceMicroUsdPerSecond: 1,
      maximumAdditionalLiabilityMicroUsd: 100,
      newPurchaseMicroUsd: 0,
      includesTaxFeesAndPartnerRetries: true,
      providerRetryAndFallbackConstraintsReviewed: true,
    },
  };
}
describe("same-runtime secret/public trust bindings", () => {
  it("reads an inherited proxy placeholder or private file without returning its value as status", async () => {
    const file = join(root, "fixture.key");
    await writeFile(file, fixtureSecret, { mode: 0o600 });
    expect(readFalSecret({ ...env, FAL_KEY: fixtureSecret })).toBe(
      fixtureSecret,
    );
    expect(readFalSecret({ ...env, FAL_KEY_FILE: file })).toBe(fixtureSecret);
    expect(falSecretStatus({ ...env, FAL_KEY_FILE: file })).toBe("CONFIGURED");
    expect(falSecretStatus(env)).toBe("MISSING");
    expect(() =>
      readFalSecret({ ...env, FAL_KEY: fixtureSecret, FAL_KEY_FILE: file }),
    ).toThrow("V01_AMBIGUOUS_SECRET_BINDING");
    for (const value of ["", " test", "line\nbreak", "tab\there", "x\0y"])
      expect(falSecretStatus({ ...env, FAL_KEY: value })).toBe("MISSING");
  });
  it("rejects symlinks, world-readable, oversized and relative secret files", async () => {
    const file = join(root, "private.key"),
      link = join(root, "linked.key");
    await writeFile(file, fixtureSecret, { mode: 0o600 });
    await symlink(file, link);
    expect(() => readPrivateBytes(link)).toThrow(
      "V01_REGULAR_BINDING_REQUIRED",
    );
    expect(() => readPrivateBytes("relative.key")).toThrow(
      "V01_ABSOLUTE_BINDING_REQUIRED",
    );
    expect(() => readPrivateBytes(file, 2)).toThrow(
      "V01_PRIVATE_BINDING_PERMISSIONS",
    );
    await chmod(file, 0o644);
    expect(() => readPrivateBytes(file)).toThrow(
      "V01_PRIVATE_BINDING_PERMISSIONS",
    );
  });
  it("accepts only the Ed25519 public verifier, never the private signer", () => {
    const keys = generateKeyPairSync("ed25519");
    const publicKey = keys.publicKey
      .export({ type: "spki", format: "pem" })
      .toString();
    expect(
      readApproverPublicKey({
        ...env,
        SPACES_V01_APPROVER_PUBLIC_KEY: publicKey,
      }),
    ).toBe(publicKey);
    expect(() =>
      readApproverPublicKey({
        ...env,
        SPACES_V01_APPROVER_PUBLIC_KEY: keys.privateKey
          .export({ type: "pkcs8", format: "pem" })
          .toString(),
      }),
    ).toThrow("V01_PUBLIC_VERIFICATION_KEY_ONLY");
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 })
      .publicKey.export({ type: "spki", format: "pem" })
      .toString();
    expect(() =>
      readApproverPublicKey({ ...env, SPACES_V01_APPROVER_PUBLIC_KEY: rsa }),
    ).toThrow("V01_APPROVER_KEY_TYPE_DENIED");
  });
});
describe("explicit operator setup and persistent single authorization", () => {
  it("requires a named operator, explicit setup approval and manual fingerprint pinning", async () => {
    await expect(setup({ operatorId: "" })).rejects.toThrow();
    await expect(setup({ approveKeySetup: false })).rejects.toThrow(
      "V01_EXPLICIT_OPERATOR_SETUP_APPROVAL_REQUIRED",
    );
    await expect(setup({ pinFingerprint: async () => false })).rejects.toThrow(
      "V01_MANUAL_TRUST_PIN_REQUIRED",
    );
    expect(await exists(join(home, "approver-private.pem"))).toBe(false);
    expect(await exists(join(home, "app-config.json"))).toBe(false);
  });
  it("keeps signer outside app/Git, preserves proxy/CA and never forwards signer configuration to application", async () => {
    const cfg = await setup();
    const launch = applicationEnvironment(cfg, {
      ...env,
      HTTPS_PROXY: "http://proxy.test.invalid",
      HTTP_PROXY: "http://proxy.test.invalid",
      NO_PROXY: "localhost",
      NODE_EXTRA_CA_CERTS: "/trusted/ca.pem",
      SPACES_V01_OPERATOR_HOME: home,
      SPACES_V01_SIGNER_PRIVATE_KEY_FILE: "/not-forwarded",
    });
    expect(launch["HTTPS_PROXY"]).toBe("http://proxy.test.invalid");
    expect(launch["HTTP_PROXY"]).toBe("http://proxy.test.invalid");
    expect(launch["NO_PROXY"]).toBe("localhost");
    expect(launch["NODE_EXTRA_CA_CERTS"]).toBe("/trusted/ca.pem");
    expect(launch["SPACES_V01_OPERATOR_HOME"]).toBeUndefined();
    expect(launch["SPACES_V01_SIGNER_PRIVATE_KEY_FILE"]).toBeUndefined();
    expect(launch["FAL_KEY"]).toBeUndefined();
    expect(launch["SPACES_V01_APPROVER_PUBLIC_KEY_FILE"]).toBe(
      cfg.publicKeyFile,
    );
    expect(readFalSecret(launch)).toBe(fixtureSecret);
    expect(JSON.stringify(cfg)).not.toContain("approver-private");
    expect(JSON.stringify(launch)).not.toContain("approver-private");
    expect(JSON.stringify(cfg)).not.toContain(fixtureSecret);
    expect(cfg.identityVerification).toBe(
      "operator-at-authenticated-terminal-not-verified-by-this-tool",
    );
    await expect(setup()).rejects.toThrow(
      "V01_EXISTING_SETUP_MUST_NOT_BE_OVERWRITTEN",
    );
  });
  it("refuses signer storage inside app, another Git repository or an app symlink", async () => {
    await expect(setup({ home: join(repo, "signer") })).rejects.toThrow(
      "V01_OPERATOR_MATERIAL_MUST_BE_OUTSIDE_APP",
    );
    const other = join(root, "other-repo");
    await mkdir(join(other, ".git"), { recursive: true });
    await expect(setup({ home: join(other, "signer") })).rejects.toThrow(
      "V01_OPERATOR_MATERIAL_MUST_BE_OUTSIDE_GIT",
    );
    const link = join(root, "app-link");
    await symlink(repo, link);
    await expect(setup({ home: join(link, "signer") })).rejects.toThrow(
      "V01_OPERATOR_MATERIAL_MUST_BE_OUTSIDE_APP",
    );
  });
  it("does not overwrite existing trust and imports only its matching externally stored signer", async () => {
    const keys = generateKeyPairSync("ed25519");
    const publicKey = keys.publicKey
      .export({ type: "spki", format: "pem" })
      .toString();
    const privateKey = keys.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    const file = join(root, "existing-test-signer.pem");
    await writeFile(file, privateKey, { mode: 0o600 });
    await expect(setup({ trustedPublicKey: publicKey })).rejects.toThrow(
      "V01_EXISTING_TRUST_REQUIRES_MATCHING_EXTERNAL_SIGNER",
    );
    const cfg = await setup({
      trustedPublicKey: publicKey,
      existingPrivateKey: file,
    });
    expect(
      readApproverPublicKey(
        applicationEnvironment(cfg, {
          ...env,
          SPACES_V01_APPROVER_PUBLIC_KEY: publicKey,
        }),
      ),
    ).toBe(publicKey);
    expect(await readFile(file, "utf8")).toBe(privateKey);
    expect(await exists(join(home, "approver-private.pem"))).toBe(false);
    const different = generateKeyPairSync("ed25519")
      .publicKey.export({ type: "spki", format: "pem" })
      .toString();
    expect(() =>
      applicationEnvironment(cfg, {
        ...env,
        SPACES_V01_APPROVER_PUBLIC_KEY: different,
      }),
    ).toThrow("V01_EXISTING_TRUST_MISMATCH");
    expect(() =>
      applicationEnvironment(cfg, { ...env, FAL_KEY: fixtureSecret }),
    ).toThrow("V01_AMBIGUOUS_SECRET_BINDING");
  });
  it("pins current source/profile/owner record and detects subsequent drift", async () => {
    const cfg = await setup();
    expect((await approvedScope(repo)).sha256).toBe(cfg.authorizationSha256);
    await writeFile(
      join(repo, "public/golden-v5/living.png"),
      "changed-source",
    );
    await expect(operatorConfig(home)).rejects.toThrow(
      "V01_APPROVED_SOURCE_DRIFT",
    );
  });
  it("prepares the approved source through existing private storage and resumes the same property without a permit or fake output", async () => {
    const cfg = await setup();
    vi.stubEnv("SPACES_V01_OPERATOR_HOME", home);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await operatorMain(["prepare"]);
    const bindingFile = join(cfg.runtimeRoot, "v01-source-binding.json");
    const first = await readFile(bindingFile, "utf8");
    expect(JSON.parse(first)).toMatchObject({
      sourceSha256: APPROVED_SOURCE,
      authorizationSha256: cfg.authorizationSha256,
    });
    await operatorMain(["prepare"]);
    expect(await readFile(bindingFile, "utf8")).toBe(first);
    expect(
      await exists(join(cfg.runtimeRoot, "v01-owner-test-permit.json")),
    ).toBe(false);
    expect(await exists(join(home, "issued-once.json"))).toBe(false);
  }, 30000);
  it.each(["access", "rights", "billing"] as const)(
    "never signs when %s is NOT_VERIFIED",
    async (field) => {
      const cfg = await setup(),
        e = await evidence(cfg);
      await expect(
        validateEvidence(cfg, {
          ...e,
          [field]: { ...e[field], state: "NOT_VERIFIED" },
        }),
      ).rejects.toThrow("V01_VERIFIED_ACCOUNT_RIGHTS_BILLING_REQUIRED");
      expect(await exists(join(home, "issued-once.json"))).toBe(false);
    },
  );
  it.each([
    { unitPriceMicroUsdPerSecond: null },
    { maximumAdditionalLiabilityMicroUsd: 10000001 },
    { maximumAdditionalLiabilityMicroUsd: null },
    { unitPriceMicroUsdPerSecond: 10000000 },
    { newPurchaseMicroUsd: 100 },
    { includesTaxFeesAndPartnerRetries: false },
    { providerRetryAndFallbackConstraintsReviewed: false },
  ])(
    "refuses incomplete or over-budget all-in liability evidence %j",
    async (changes) => {
      const cfg = await setup(),
        e = await evidence(cfg);
      await expect(
        validateEvidence(cfg, { ...e, billing: { ...e.billing, ...changes } }),
      ).rejects.toThrow("V01_TOTAL_LIABILITY_NOT_PROVEN_WITHIN_USD10");
    },
  );
  it("rejects expired, wrong-operator, foreign-source and altered private evidence", async () => {
    const cfg = await setup(),
      e = await evidence(cfg);
    for (const changes of [
      { expiresAtMs: Date.now() - 1 },
      { verifiedByOperator: "unrelated-operator" },
      { sourceSha256: "a".repeat(64) },
    ])
      await expect(validateEvidence(cfg, { ...e, ...changes })).rejects.toThrow(
        "V01_EVIDENCE_SCOPE_OR_AGE_DENIED",
      );
    await writeFile(e.access.artifact.file, "modified evidence", {
      mode: 0o600,
    });
    await expect(validateEvidence(cfg, e)).rejects.toThrow(
      "V01_EVIDENCE_ARTIFACT_CHANGED",
    );
  });
  it("issues one compatible short-lived source-bound TEST permit and never reissues after restart", async () => {
    const cfg = await setup(),
      e = await evidence(cfg);
    await mkdir(cfg.runtimeRoot, { recursive: true, mode: 0o700 });
    await writeFile(
      join(cfg.runtimeRoot, "v01-source-binding.json"),
      JSON.stringify({
        organizationId: "studio",
        propertyId: "test-property",
        revision: 2,
        assetId: "test-asset",
        sourceSha256: APPROVED_SOURCE,
        authorizationSha256: cfg.authorizationSha256,
      }),
      { mode: 0o600 },
    );
    // process.env has no operational secret/trust in isolated CI; app gets this fixture's private file only.
    vi.stubEnv("FAL_KEY", "");
    vi.stubEnv("FAL_KEY_FILE", "");
    vi.stubEnv("SPACES_V01_APPROVER_PUBLIC_KEY", "");
    vi.stubEnv("SPACES_V01_APPROVER_PUBLIC_KEY_FILE", "");
    const issued = await issuePermit(home, e);
    const verifier = new FileV01Authority(cfg.runtimeRoot, () =>
      readApproverPublicKey(applicationEnvironment(cfg, env)),
    );
    const loaded = await verifier.load(Date.now());
    expect(issued.status).toBe("CONFIGURED");
    expect(loaded.permit).toMatchObject({
      id: AUTHORIZATION_ID,
      mode: "fal-live-test",
      maxRequests: 1,
      durationSeconds: 4,
      aspectRatio: "16:9",
      model: "kling/v4/image-to-video",
      sourceSha256: APPROVED_SOURCE,
      fixtureOutputSha256: null,
    });
    expect(loaded.permit.totalCapMicroUsd).toBeLessThanOrEqual(10000000);
    expect(loaded.permit.expiresAtMs - Date.now()).toBeLessThanOrEqual(900000);
    await expect(issuePermit(home, e)).rejects.toThrow(
      "V01_ALREADY_ISSUED_RESUME_OR_RECONCILE_NO_REISSUE",
    );
    await rm(join(cfg.runtimeRoot, "v01-owner-test-permit.json"));
    await expect(issuePermit(home, e)).rejects.toThrow(
      "V01_ALREADY_ISSUED_RESUME_OR_RECONCILE_NO_REISSUE",
    );
  });
  it("status is credential-safe and noninteractive setup refuses without TTY or issuing anything", async () => {
    vi.stubEnv("SPACES_V01_OPERATOR_HOME", home);
    vi.stubEnv("FAL_KEY", "");
    vi.stubEnv("FAL_KEY_FILE", "");
    vi.stubEnv("SPACES_V01_APPROVER_PUBLIC_KEY", "");
    vi.stubEnv("SPACES_V01_APPROVER_PUBLIC_KEY_FILE", "");
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    await operatorMain(["status"]);
    expect(JSON.parse(output.mock.calls[0]![0] as string)).toMatchObject({
      OWNER_AUTHORIZATION: "APPROVED_CONDITIONAL",
      maximumUsd: 10,
      FAL_KEY: "MISSING",
      RUNTIME_PERMIT: "MISSING",
      MODEL_ACCESS: "NOT_VERIFIED",
      providerExecutedByThisCommand: false,
    });
    expect(JSON.stringify(output.mock.calls)).not.toContain(home);
    await expect(operatorMain(["setup"])).rejects.toThrow(
      "V01_OPERATOR_TTY_REQUIRED",
    );
    expect(await exists(join(home, "app-config.json"))).toBe(false);
  });
});
