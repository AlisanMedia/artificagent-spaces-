import sharp from "sharp";
import { createHash } from "node:crypto";
import { invariant } from "@/domain/platform";
import type { ProductionServiceId } from "@/domain/production-services";
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
export interface SourceBinding {
  organizationId: string;
  propertyId: string;
  revision: number;
  sourceSha256: string;
}
function assertBinding(actual: SourceBinding, expected: SourceBinding) {
  invariant(
    actual.organizationId === expected.organizationId &&
      actual.propertyId === expected.propertyId &&
      actual.revision === expected.revision &&
      actual.sourceSha256 === expected.sourceSha256,
    "QA_SOURCE_SCOPE_DENIED",
    403,
  );
}
/** Validates actual source-sized binary PNG bytes. protectedPixels are server/human-reviewed structural/rights regions. */
export async function validateSourceMask(
  source: Uint8Array,
  mask: Uint8Array,
  binding: SourceBinding,
  expected: SourceBinding,
  protectedPixels?: Uint8Array,
) {
  assertBinding(binding, expected);
  invariant(sha(source) === binding.sourceSha256, "SOURCE_HASH_MISMATCH", 409);
  invariant(
    mask.length > 0 &&
      mask.length <= 5_242_880 &&
      Buffer.from(mask)
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "MASK_PNG_REQUIRED",
    422,
  );
  const s = await sharp(source, {
    limitInputPixels: 12_000_000,
    failOn: "warning",
  }).metadata();
  const m = await sharp(mask, {
    limitInputPixels: 12_000_000,
    failOn: "warning",
  }).metadata();
  invariant(
    m.format === "png" &&
      m.width === s.width &&
      m.height === s.height &&
      (m.pages ?? 1) === 1 &&
      !m.hasAlpha,
    "MASK_GEOMETRY_REQUIRED",
    422,
  );
  const pixels = await sharp(mask)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const total = pixels.info.width * pixels.info.height,
    channels = pixels.info.channels;
  invariant(
    !protectedPixels || protectedPixels.length === total,
    "PROTECTED_REGION_DIMENSIONS",
    422,
  );
  const binary = new Uint8Array(total);
  let white = 0;
  for (let i = 0; i < total; i++) {
    const v = pixels.data[i * channels]!;
    invariant(
      (v === 0 || v === 255) &&
        Array.from(
          { length: channels },
          (_, c) => pixels.data[i * channels + c],
        ).every((c) => c === v),
      "MASK_BINARY_REQUIRED",
      422,
    );
    invariant(
      v === 0 || !protectedPixels?.[i],
      "PROTECTED_ARCHITECTURE_OR_ATTRIBUTION",
      403,
    );
    if (v === 255) {
      binary[i] = 1;
      white++;
    }
  }
  invariant(white > 0 && white / total <= 0.6, "MASK_EMPTY_OR_OVERBROAD", 422);
  return {
    sourceSha256: sha(source),
    maskSha256: sha(mask),
    width: s.width!,
    height: s.height!,
    fraction: white / total,
    binary,
    machineValidated: true as const,
    humanReviewRequired: true as const,
  };
}
export interface ImageQaInput {
  serviceId: ProductionServiceId;
  source: Uint8Array;
  candidate: Uint8Array;
  binding: SourceBinding;
  expected: SourceBinding;
  mask?: Uint8Array;
  criticalFindings?: readonly string[];
}
/** Objective bounded triage only: no semantic model, survey, SSIM benchmark or fidelity guarantee. */
export async function inspectProductionImage(input: ImageQaInput) {
  assertBinding(input.binding, input.expected);
  invariant(
    sha(input.source) === input.binding.sourceSha256,
    "SOURCE_HASH_MISMATCH",
    409,
  );
  invariant(
    input.candidate.length > 0 && input.candidate.length <= 20_971_520,
    "OUTPUT_SIZE_LIMIT",
    413,
  );
  const b = Buffer.from(input.candidate),
    png = b
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    jpeg = b[0] === 255 && b[1] === 216 && b[2] === 255,
    webp =
      b.subarray(0, 4).toString() === "RIFF" &&
      b.subarray(8, 12).toString() === "WEBP";
  invariant(png || jpeg || webp, "OUTPUT_MAGIC_DENIED", 415);
  const decoder = sharp(b, {
    limitInputPixels: 12_000_000,
    failOn: "warning",
    animated: false,
  });
  const m = await decoder.metadata(),
    s = await sharp(input.source, { limitInputPixels: 12_000_000 }).metadata();
  invariant(
    (m.pages ?? 1) === 1 &&
      m.width &&
      m.height &&
      ["png", "jpeg", "webp"].includes(m.format!),
    "OUTPUT_DECODE_DENIED",
    422,
  );
  const reasons: string[] = [];
  if (m.width !== s.width || m.height !== s.height)
    reasons.push("FRAMING_OR_DIMENSIONS_CHANGED");
  if (m.exif || m.xmp || m.iptc) reasons.push("PRIVATE_METADATA_PRESENT");
  const clean = await decoder.rotate().png().toBuffer();
  const size = { width: 128, height: 128, fit: "fill" as const };
  const a = await sharp(input.source).resize(size).greyscale().raw().toBuffer(),
    c = await sharp(clean).resize(size).greyscale().raw().toBuffer();
  const mean = c.reduce((x, y) => x + y, 0) / c.length;
  if (mean < 3 || mean > 252) reasons.push("BLANK_OR_CLIPPED");
  let edgeMismatch = 0,
    edgeCount = 0;
  for (let y = 1; y < 127; y++)
    for (let x = 1; x < 127; x++) {
      const i = y * 128 + x;
      const ea =
        Math.abs(a[i + 1]! - a[i - 1]!) + Math.abs(a[i + 128]! - a[i - 128]!);
      const ec =
        Math.abs(c[i + 1]! - c[i - 1]!) + Math.abs(c[i + 128]! - c[i - 128]!);
      if (ea > 30 || ec > 30) {
        edgeCount++;
        if (ea > 30 !== ec > 30) edgeMismatch++;
      }
    }
  const edgeDisagreement = edgeCount ? edgeMismatch / edgeCount : 0;
  if (edgeDisagreement > 0.15) reasons.push("STRUCTURAL_EDGE_TRIAGE");
  let outsideChanged = 0,
    outsideCount = 0;
  if (input.serviceId === "P05" || input.serviceId === "P07b") {
    invariant(input.mask, "SOURCE_BOUND_MASK_REQUIRED", 422);
    const mask = await validateSourceMask(
      input.source,
      input.mask,
      input.binding,
      input.expected,
    );
    const rawA = await sharp(input.source)
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer();
    const rawC = await sharp(clean)
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer();
    if (rawA.length !== rawC.length) reasons.push("ROI_REGISTRATION_REQUIRED");
    else
      for (let i = 0; i < mask.binary.length; i++) {
        // A two-pixel blending border is allowed, never an unbounded edited area.
        const x = i % mask.width,
          y = Math.floor(i / mask.width);
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++)
          for (let dx = -2; dx <= 2; dx++)
            if (
              x + dx >= 0 &&
              x + dx < mask.width &&
              y + dy >= 0 &&
              y + dy < mask.height &&
              mask.binary[(y + dy) * mask.width + x + dx]
            ) {
              near = true;
              break;
            }
        if (!near) {
          outsideCount++;
          if (
            Math.max(
              ...[0, 1, 2].map((k) =>
                Math.abs(rawA[i * 3 + k]! - rawC[i * 3 + k]!),
              ),
            ) > 12
          )
            outsideChanged++;
        }
      }
    if (outsideChanged > 0) reasons.push("NON_TARGET_EDIT");
  }
  const critical = [...(input.criticalFindings ?? [])];
  return {
    profile: "fidelity-triage-v1" as const,
    state: critical.length
      ? ("REJECTED" as const)
      : reasons.length
        ? ("QA_HOLD" as const)
        : ("AWAITING_INDEPENDENT_REVIEW" as const),
    reasons,
    critical,
    measurements: {
      edgeDisagreement,
      outsideChanged,
      outsideCount,
      mean,
      width: m.width,
      height: m.height,
      outputSha256: sha(clean),
      inputCandidateSha256: sha(input.candidate),
    },
    clean,
    calibratedOnRealProvider: false as const,
    semanticArchitectureVerified: false as const,
    autoRelease: false as const,
  };
}
