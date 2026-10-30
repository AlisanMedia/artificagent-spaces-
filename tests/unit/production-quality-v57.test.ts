// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import {
  inspectProductionImage,
  validateSourceMask,
} from "@/server/production/quality";
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
let source: Buffer, mask: Buffer;
let binding: {
  organizationId: string;
  propertyId: string;
  revision: number;
  sourceSha256: string;
};
beforeAll(async () => {
  source = await sharp(
    Buffer.from(
      '<svg width="320" height="240"><rect width="320" height="240" fill="#b3b3a0"/><path d="M60 220V30H260V220M60 70H260M160 30V220" stroke="#253e32" stroke-width="5" fill="none"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  const pixels = Buffer.alloc(320 * 240);
  for (let y = 100; y < 140; y++)
    for (let x = 100; x < 140; x++) pixels[y * 320 + x] = 255;
  mask = await sharp(pixels, { raw: { width: 320, height: 240, channels: 1 } })
    .png()
    .toBuffer();
  binding = {
    organizationId: "org-a",
    propertyId: "property-a",
    revision: 1,
    sourceSha256: hash(source),
  };
});
describe("bounded real-image mask and fidelity triage", () => {
  it("decodes actual source-aligned PNG mask bytes and requires later human review", async () => {
    const r = await validateSourceMask(source, mask, binding, binding);
    expect(r.width).toBe(320);
    expect(r.fraction).toBeCloseTo(1600 / (320 * 240));
    expect(r.maskSha256).toBe(hash(mask));
    expect(r.humanReviewRequired).toBe(true);
  });
  it("rejects wrong source/property/tenant/revision, forged hashes and protected pixels", async () => {
    for (const p of [
      { organizationId: "org-b" },
      { propertyId: "property-b" },
      { revision: 2 },
    ])
      await expect(
        validateSourceMask(source, mask, { ...binding, ...p }, binding),
      ).rejects.toThrow("QA_SOURCE_SCOPE_DENIED");
    await expect(
      validateSourceMask(Buffer.from("tampered"), mask, binding, binding),
    ).rejects.toThrow("SOURCE_HASH_MISMATCH");
    const protectedPixels = new Uint8Array(320 * 240);
    protectedPixels[110 * 320 + 110] = 1;
    await expect(
      validateSourceMask(source, mask, binding, binding, protectedPixels),
    ).rejects.toThrow("PROTECTED_ARCHITECTURE_OR_ATTRIBUTION");
  });
  it.each([0, 128, 255])(
    "rejects empty/overbroad/nonbinary mask value %i",
    async (v) => {
      const b = await sharp(Buffer.alloc(320 * 240, v), {
        raw: { width: 320, height: 240, channels: 1 },
      })
        .png()
        .toBuffer();
      await expect(
        validateSourceMask(source, b, binding, binding),
      ).rejects.toThrow();
    },
  );
  it("rejects size, alpha, non-PNG and malformed image claims", async () => {
    const wrong = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const alpha = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();
    for (const b of [
      wrong,
      alpha,
      Buffer.from("<svg/>"),
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
    ])
      await expect(
        validateSourceMask(source, b, binding, binding),
      ).rejects.toThrow();
  });
  it("identity fixture is valid media but never an automatically accepted AI result", async () => {
    const r = await inspectProductionImage({
      serviceId: "P01",
      source,
      candidate: source,
      binding,
      expected: binding,
    });
    expect(r.state).toBe("AWAITING_INDEPENDENT_REVIEW");
    expect(r.autoRelease).toBe(false);
    expect(r.semanticArchitectureVerified).toBe(false);
    expect(r.calibratedOnRealProvider).toBe(false);
    expect(r.measurements.outputSha256).toBe(hash(r.clean));
    expect((await sharp(r.clean).metadata()).exif).toBeUndefined();
  });
  it("flags real blank/changed-framing/moved-edge candidates", async () => {
    const blank = await sharp({
      create: { width: 320, height: 240, channels: 3, background: "black" },
    })
      .png()
      .toBuffer();
    expect(
      (
        await inspectProductionImage({
          serviceId: "P01",
          source,
          candidate: blank,
          binding,
          expected: binding,
        })
      ).reasons,
    ).toContain("BLANK_OR_CLIPPED");
    const moved = await sharp(source).flop().resize(160, 120).png().toBuffer();
    const r = await inspectProductionImage({
      serviceId: "P01",
      source,
      candidate: moved,
      binding,
      expected: binding,
    });
    expect(r.state).toBe("QA_HOLD");
    expect(r.reasons).toContain("FRAMING_OR_DIMENSIONS_CHANGED");
  });
  it("finds actual non-target pixel edits beyond the bounded blending border", async () => {
    const edit = await sharp(source)
      .composite([
        {
          input: Buffer.from(
            '<svg width="50" height="50"><rect width="50" height="50" fill="red"/></svg>',
          ),
          left: 200,
          top: 150,
        },
      ])
      .png()
      .toBuffer();
    const r = await inspectProductionImage({
      serviceId: "P05",
      source,
      candidate: edit,
      mask,
      binding,
      expected: binding,
    });
    expect(r.measurements.outsideChanged).toBeGreaterThan(0);
    expect(r.reasons).toContain("NON_TARGET_EDIT");
    expect(r.state).toBe("QA_HOLD");
    await expect(
      inspectProductionImage({
        serviceId: "P05",
        source,
        candidate: source,
        binding,
        expected: binding,
      }),
    ).rejects.toThrow("SOURCE_BOUND_MASK_REQUIRED");
  });
  it("rejects any critical architecture/privacy finding even if the pixel fixture is unchanged", async () => {
    const r = await inspectProductionImage({
      serviceId: "P01",
      source,
      candidate: source,
      binding,
      expected: binding,
      criticalFindings: ["invented_window"],
    });
    expect(r.state).toBe("REJECTED");
    expect(r.autoRelease).toBe(false);
  });
  it("fails closed on invalid byte format and embedded private metadata", async () => {
    await expect(
      inspectProductionImage({
        serviceId: "P01",
        source,
        candidate: Buffer.from("<html>not an image</html>"),
        binding,
        expected: binding,
      }),
    ).rejects.toThrow("OUTPUT_MAGIC_DENIED");
    const privateMeta = await sharp(source)
      .withExif({ IFD0: { Artist: "synthetic-metadata-do-not-publish" } })
      .jpeg()
      .toBuffer();
    const r = await inspectProductionImage({
      serviceId: "P01",
      source,
      candidate: privateMeta,
      binding,
      expected: binding,
    });
    expect(r.reasons).toContain("PRIVATE_METADATA_PRESENT");
    expect((await sharp(r.clean).metadata()).exif).toBeUndefined();
  });
});
