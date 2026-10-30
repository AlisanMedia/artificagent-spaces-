// @vitest-environment node
import { beforeAll, it, expect } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { verifyV01HumanReview } from "@/server/v01/review-proof";
let root: string;
const owner = generateKeyPairSync("ed25519"),
  reviewer = generateKeyPairSync("ed25519");
const ownerPublic = owner.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
const reviewerPublic = reviewer.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
const expected = {
  jobId: "synthetic-review-job",
  organizationId: "studio",
  propertyId: "synthetic-property",
  revision: 1,
  reviewerId: "reviewer-separate",
  creatorId: "creator-one",
  sourceSha256: "a".repeat(64),
  outputSha256: "b".repeat(64),
};
beforeAll(async () => {
  const p = join(process.cwd(), ".spaces-local", "v01-human-proof-tests");
  await mkdir(p, { recursive: true, mode: 0o700 });
  root = await mkdtemp(join(p, "run-"));
  await mkdir(join(root, "v01-human-reviews"));
});
async function proof(
  overrides: Record<string, unknown> = {},
  signingKey = reviewer.privateKey,
) {
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      version: "v01-independent-human-review-v1",
      ...expected,
      independentHumanReview: true,
      issuedAtMs: now - 100,
      expiresAtMs: now + 60_000,
      ...overrides,
    }),
  );
  await writeFile(
    join(root, "v01-human-reviews", expected.jobId + ".json"),
    JSON.stringify({
      payload: payload.toString("base64url"),
      signature: sign(null, payload, signingKey).toString("hex"),
    }),
    { mode: 0o600 },
  );
}
it("a real-mode review needs a distinct provisioned reviewer key, exact artifact/source and short-lived signature", async () => {
  await proof();
  expect(
    await verifyV01HumanReview(root, expected, reviewerPublic, ownerPublic),
  ).toMatch(/^[a-f0-9]{64}$/);
  await expect(
    verifyV01HumanReview(root, expected, undefined, ownerPublic),
  ).rejects.toThrow("V01_REAL_REVIEWER_PROOF_REQUIRED");
  await expect(
    verifyV01HumanReview(root, expected, ownerPublic, ownerPublic),
  ).rejects.toThrow("V01_DISTINCT_REVIEWER_KEY_REQUIRED");
});
it.each([
  { outputSha256: "c".repeat(64) },
  { sourceSha256: "c".repeat(64) },
  { organizationId: "atelier" },
  { reviewerId: "unassigned-person" },
  { revision: 2 },
  { expiresAtMs: 1 },
])("refuses altered or stale reviewer evidence %j", async (patch) => {
  await proof(patch);
  await expect(
    verifyV01HumanReview(root, expected, reviewerPublic, ownerPublic),
  ).rejects.toThrow();
});
it("an owner signature cannot substitute for the independent reviewer's signature", async () => {
  await proof({}, owner.privateKey);
  await expect(
    verifyV01HumanReview(root, expected, reviewerPublic, ownerPublic),
  ).rejects.toThrow("V01_REVIEWER_SIGNATURE_INVALID");
});
