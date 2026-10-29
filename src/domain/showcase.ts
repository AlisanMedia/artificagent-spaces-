/** Public authored fixtures only. Selectors never authorize private media or provider execution. */
import { z } from "zod";
const Id = z.string().regex(/^[a-z0-9-]{1,60}$/);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
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
    rights: z.literal("PROJECT_AUTHORED_SYNTHETIC"),
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
    capture: z.literal("BLENDER_CYCLES_SYNTHETIC").optional(),
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
    rights: z.literal("PROJECT_AUTHORED_SYNTHETIC"),
    production: z.literal(false),
    assets: z.array(Asset).min(1).max(40),
    samples: z.array(Sample).length(4),
    spatialSamples: z
      .array(
        z
          .object({
            id: Id,
            product: z.enum(["ai-3d", "tour-360"]),
            style: z.literal("authored-synthetic"),
            sourceId: Id,
            outputId: Id,
            sourceRelationship: z.literal(
              "SAME_AUTHORED_CAD_NOT_PHOTO_RECONSTRUCTION",
            ),
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
    humanReviewers: z.null(),
    externalProviderCalls: z.literal(0),
  })
  .strict()
  .superRefine((v, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const get = (id: string) => v.assets.find((a) => a.id === id);
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
    if (!m || m.type !== "model" || m.propertyId !== p?.propertyId)
      fail("MODEL_SCOPE_MISMATCH");
  });
export type SampleRegistry = z.infer<typeof ShowcaseRegistry>;
export type SampleAsset = z.infer<typeof Asset>;
export type VideoSample = z.infer<typeof Sample>;
