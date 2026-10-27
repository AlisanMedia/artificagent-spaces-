import { z } from "zod";
import { PROPERTY_STYLE_IDS } from "./real-estate-styles";

/** An explicit new path; legacy 4/8/16-second jobs retain their old contract. */
export const PhotoCompositionSettings = z
  .object({
    version: z.literal("property-video-v1"),
    styleId: z.enum(PROPERTY_STYLE_IDS),
    requestedDurationSeconds: z.union([
      z.literal(30),
      z.literal(45),
      z.literal(60),
    ]),
  })
  .strict();
export type PhotoComposition = z.infer<typeof PhotoCompositionSettings>;
