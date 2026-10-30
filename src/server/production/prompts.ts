import { createHash } from "node:crypto";
import {
  ServiceOptions,
  type ProductionServiceId,
} from "@/domain/production-services";
import { invariant } from "@/domain/platform";

export const ARCH_PRESERVE =
  "Use the supplied property photograph as the visual reference. Keep the visible room structure, door and window positions, columns, fixed fixtures, existing materials, furniture placement, perspective and lighting consistent across frames. One continuous, smoothly stabilized architectural shot. No invented rooms, openings, additional furniture or structural changes.";
const VIDEO = Object.freeze({
  V01: "The camera advances very slowly forward at natural eye level through the visible space, creating gentle parallax only from the existing architectural surfaces. Constant natural exposure and realistic reflections. Perfectly smooth gimbal motion, straight vertical lines, continuous single shot.",
  V02: "A restrained luxury property film shot. The camera performs one slow horizontal slider movement, moving slightly from left to right while keeping the original architecture geometrically consistent. Subtle natural parallax, realistic materials and reflections, refined exposure, no change in furniture or lighting direction. Elegant, uninterrupted professional real-estate cinematography.",
  V03: "From a fixed eye-level position, the camera performs a very slow, small horizontal pan across the room to reveal existing architectural details. Keep all vertical lines stable and retain the original layout, windows, ceiling edges and materials. Smooth natural pacing, one continuous shot, no jump cuts.",
  V04: "The camera makes a restrained, slow upward crane movement while keeping the photographed building facade, roofline, balcony edges and window arrangement visually consistent. Maintain the existing skyline and neighboring structures. Natural outdoor light, stable perspective and a single uninterrupted architectural shot.",
});
export const WORLD_GUIDANCE =
  "Create a photorealistic, navigable spatial interpretation of the supplied views of the same interior scene. Favor the visible floor, wall, door, window and furniture relationships and the original room atmosphere. Maintain plausible scale and camera continuity. Treat unobserved regions as uncertain rather than asserting an exact architectural survey or connecting unseen rooms. Natural materials and physically plausible lighting.";
export const PROFILE_VERSIONS = Object.freeze({
  V01: "video.natural.v1",
  V02: "video.premium.v1",
  V03: "video.explore.v1",
  V04: "video.exterior.v1",
  P01: "photo.enhance.hifi.v1",
  P02: "photo.perspective.hifi.v1",
  P03: "photo.furnish.v1",
  P04: "photo.empty.v1",
  P05: "photo.remove.mask.v1",
  P06: "photo.sky.v1",
  P07: "photo.renovate.v1",
  P07b: "photo.precision-edit.v1",
  T01: "tour.360.v1",
  T02: "world.ai3d.v1",
  B01: "bundle.listing.v1",
});
const FINISH = Object.freeze({
  "warm-white-paint": "warm white matte paint",
  "sage-paint": "muted sage matte paint",
  "natural-oak": "natural oak flooring",
  "neutral-stone": "neutral stone flooring",
});
/** Called by the server only, never accepts free-text instructions. Hash is canonical UTF-8 bytes, not a marketing quality score. */
export function compileServiceProfile(
  id: ProductionServiceId,
  input: unknown = {},
) {
  const options = ServiceOptions.parse(input);
  let text: string | null = null;
  if (id in VIDEO) text = `${VIDEO[id as keyof typeof VIDEO]} ${ARCH_PRESERVE}`;
  if (id === "T02") text = WORLD_GUIDANCE;
  if (id === "P07b") {
    invariant(
      options.target && options.finish,
      "APPROVED_FINISH_REQUIRED",
      422,
    );
    invariant(
      options.target === "wall"
        ? options.finish.endsWith("paint")
        : !options.finish.endsWith("paint"),
      "FINISH_TARGET_MISMATCH",
      422,
    );
    text = `Perform a localized architectural finish visualization on the provided real property photograph. Change only the user-approved ${options.target} to ${FINISH[options.finish]} in the existing visible geometry. Preserve the exact camera viewpoint, field of view, wall boundaries, window and door openings, ceiling height, floor joints outside the target, fixtures, furniture, reflections and natural light direction. The rest of the photograph should remain visually consistent with the source. Professional natural architectural photography; no invented objects, no layout alterations. This is a proposed design, not an image of existing conditions.`;
  }
  const version = PROFILE_VERSIONS[id];
  const canonical = JSON.stringify({
    serviceId: id,
    version,
    text,
    options: Object.fromEntries(
      Object.entries(options).sort(([a], [b]) => a.localeCompare(b)),
    ),
  });
  return Object.freeze({
    version,
    text,
    promptSha256:
      text === null
        ? null
        : createHash("sha256").update(text, "utf8").digest("hex"),
    profileSha256: createHash("sha256").update(canonical).digest("hex"),
    negativePromptSupported: false as const,
    qualityGuarantee: "NONE_INDEPENDENT_REVIEW_REQUIRED" as const,
  });
}
