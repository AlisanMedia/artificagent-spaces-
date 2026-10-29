/** Curated public references and authored fixtures only. No private media/provider authorization. */
import { z } from "zod";
const Id = z.string().regex(/^[a-z0-9-]{1,60}$/);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const PublicLicense = z
  .object({
    id: z.literal("CC0-1.0"),
    licenseUrl: z.literal("https://polyhaven.com/license"),
    sourcePage: z.enum([
      "https://polyhaven.com/a/brown_photostudio_04",
      "https://polyhaven.com/a/modern_buildings_2",
    ]),
    author: z.string().min(1).max(100),
    retrievedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    upstreamSha256: Hash,
  })
  .strict();
const Asset = z
  .object({
    id: Id,
    url: z
      .string()
      .regex(
        /^\/(?:golden-v5|showcase-v55)\/[a-z0-9-]+\.(?:png|webp|jpg|mp4|glb)$/,
      ),
    sha256: Hash,
    bytes: z.number().int().positive().max(8_000_000),
    type: z.enum(["image", "video", "model", "panorama"]),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    aspectRatio: z
      .string()
      .regex(/^\d+:\d+$/)
      .nullable(),
    rights: z.enum(["PROJECT_AUTHORED_SYNTHETIC", "VERIFIED_CC0_REFERENCE"]),
    license: PublicLicense.optional(),
    production: z.literal(false),
    propertyId: Id,
    cameraId: Id.nullable(),
    sourceId: Id.optional(),
    sourceHash: Hash.optional(),
    durationSeconds: z.number().positive().max(60).optional(),
    codec: z.literal("h264").optional(),
    pixelFormat: z.string().optional(),
    audioStreams: z.literal(0).optional(),
    externalSpendMicroUsd: z.literal(0).optional(),
    projection: z.literal("equirectangular").optional(),
    capture: z
      .enum(["BLENDER_CYCLES_SYNTHETIC", "LICENSED_CC0_PHOTOGRAPHY"])
      .optional(),
    roomLabel: z.string().max(50).optional(),
  })
  .strict();
const Sample = z
  .object({
    id: Id,
    product: z.literal("video"),
    style: z.enum(["natural", "premium", "explore", "exterior"]),
    sourceId: Id,
    outputId: Id,
    posterId: Id,
    thumbnailId: Id,
    alt: z.string().min(1).max(220),
    disclosure: z.string().min(1).max(300),
  })
  .strict();
export const ShowcaseRegistry = z
  .object({
    version: z.literal("showcase-v55"),
    rights: z.enum([
      "PROJECT_AUTHORED_SYNTHETIC",
      "MIXED_AUTHORED_AND_VERIFIED_CC0",
    ]),
    production: z.literal(false),
    assets: z.array(Asset).min(1).max(40),
    samples: z.array(Sample).length(4),
    spatialSamples: z
      .array(
        z
          .object({
            id: Id,
            product: z.enum(["ai-3d", "tour-360"]),
            style: z.enum(["authored-synthetic", "licensed-reference"]),
            sourceId: Id,
            outputId: Id,
            sourceRelationship: z.enum([
              "SAME_AUTHORED_CAD_NOT_PHOTO_RECONSTRUCTION",
              "LICENSED_PANORAMA_AND_PERSPECTIVE_FRAME",
            ]),
            disclosure: z.string().min(1),
            alt: z.string().min(1),
          })
          .strict(),
      )
      .length(2),
    comparison: z
      .object({
        beforeId: Id,
        afterId: Id,
        sourceId: Id,
        method: z.string(),
        disclosure: z.string(),
      })
      .strict(),
    modelId: Id,
    panoramaId: Id,
    modelPosterId: Id.optional(),
    panoramaPosterId: Id.optional(),
    humanReviewers: z.null(),
    externalProviderCalls: z.literal(0),
  })
  .strict()
  .superRefine((v, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const get = (id: string) => v.assets.find((a) => a.id === id);
    if (
      v.assets.some((a) => a.rights === "VERIFIED_CC0_REFERENCE") !==
      (v.rights === "MIXED_AUTHORED_AND_VERIFIED_CC0")
    )
      fail("SHOWCASE_RIGHTS_CLASS_MISMATCH");
    for (const a of v.assets) {
      if ((a.rights === "VERIFIED_CC0_REFERENCE") !== !!a.license)
        fail("VERIFIED_LICENSE_REQUIRED");
    }
    if (new Set(v.spatialSamples.map((s) => s.product)).size !== 2)
      fail("SPATIAL_PRODUCT_MISMATCH");
    for (const sample of v.spatialSamples) {
      const source = get(sample.sourceId),
        out = get(sample.outputId);
      if (
        !source ||
        !out ||
        source.propertyId !== out.propertyId ||
        out.id !== (sample.product === "ai-3d" ? v.modelId : v.panoramaId)
      )
        fail("SPATIAL_SOURCE_MISMATCH");
      if (
        sample.product === "tour-360" &&
        out?.capture === "LICENSED_CC0_PHOTOGRAPHY" &&
        (sample.style !== "licensed-reference" ||
          sample.sourceRelationship !==
            "LICENSED_PANORAMA_AND_PERSPECTIVE_FRAME" ||
          source?.rights !== out.rights ||
          source?.license?.upstreamSha256 !== out.license?.upstreamSha256)
      )
        fail("SPATIAL_LICENSE_SOURCE_MISMATCH");
    }
    if (
      new Set(v.assets.map((a) => a.id)).size !== v.assets.length ||
      new Set(v.samples.map((s) => s.style)).size !== 4
    )
      fail("SHOWCASE_DUPLICATE");
    for (const s of v.samples) {
      const source = get(s.sourceId),
        out = get(s.outputId),
        poster = get(s.posterId),
        thumb = get(s.thumbnailId);
      if (
        !source ||
        !out ||
        !poster ||
        !thumb ||
        source.type !== "image" ||
        out.type !== "video" ||
        poster.type !== "image" ||
        thumb.type !== "image" ||
        out.sourceId !== source.id ||
        out.propertyId !== source.propertyId ||
        out.cameraId !== source.cameraId ||
        poster.sourceId !== out.id ||
        thumb.sourceId !== out.id ||
        !out.durationSeconds ||
        out.codec !== "h264" ||
        out.audioStreams !== 0
      )
        fail("SHOWCASE_SOURCE_OR_OUTPUT_MISMATCH");
      if (
        source &&
        out &&
        (source.rights !== out.rights ||
          source.license?.upstreamSha256 !== out.license?.upstreamSha256)
      )
        fail("SHOWCASE_LICENSE_SOURCE_MISMATCH");
    }
    const c = v.comparison,
      b = get(c.beforeId),
      a = get(c.afterId),
      s = get(c.sourceId);
    if (
      !a ||
      !b ||
      !s ||
      a.type !== "image" ||
      b.type !== "image" ||
      a.sha256 === b.sha256 ||
      a.width !== b.width ||
      a.height !== b.height ||
      a.propertyId !== s.propertyId ||
      b.propertyId !== s.propertyId ||
      a.cameraId !== s.cameraId ||
      b.cameraId !== s.cameraId ||
      a.sourceHash !== s.sha256 ||
      b.sourceHash !== s.sha256
    )
      fail("COMPARISON_SOURCE_MISMATCH");
    const p = get(v.panoramaId),
      m = get(v.modelId);
    if (
      !p ||
      p.type !== "panorama" ||
      p.projection !== "equirectangular" ||
      p.width !== 2 * (p.height ?? 0) ||
      !p.cameraId ||
      !p.roomLabel
    )
      fail("PANORAMA_PROJECTION_REQUIRED");
    if (!m || m.type !== "model") fail("MODEL_SCOPE_MISMATCH");
    for (const [posterId, outputId] of [
      [v.modelPosterId, v.modelId],
      [v.panoramaPosterId, v.panoramaId],
    ]) {
      if (!posterId) continue;
      const poster = get(posterId),
        output = get(outputId!);
      if (
        !poster ||
        !output ||
        poster.type !== "image" ||
        poster.sourceId !== output.id ||
        poster.propertyId !== output.propertyId ||
        poster.rights !== output.rights
      )
        fail("SPATIAL_POSTER_SOURCE_MISMATCH");
    }
  });
export type SampleRegistry = z.infer<typeof ShowcaseRegistry>;
export type SampleAsset = z.infer<typeof Asset>;
export type VideoSample = z.infer<typeof Sample>;
