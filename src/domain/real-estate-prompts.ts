import { z } from "zod";
import {
  PROPERTY_STYLE_IDS,
  type PropertyVideoStyle,
} from "./real-estate-styles";

export const PROPERTY_PROMPT_VERSION = "property-video-v1" as const;
export const PROPERTY_SOURCE_SUFFIX =
  "Use the provided property photograph as the visual reference. Keep visible architectural lines, doors, windows, surfaces, furniture placement and lighting consistent with the source. Professional stabilized real-estate cinematography. One continuous shot.";
export const PropertyStyle = z.enum(PROPERTY_STYLE_IDS);
export const PROPERTY_CAMERA_PROMPTS = Object.freeze({
  natural:
    "The camera performs a subtle slow forward dolly at natural eye level, revealing realistic parallax within the visible room. Calm, balanced movement with a stable architectural perspective.",
  premium:
    "The camera glides slowly from left to right in a refined architectural slider shot. Elegant measured pacing, natural reflections, soft existing daylight and restrained cinematic depth.",
  explore:
    "The camera makes a slow horizontal pan across the visible room from a fixed eye-level position. Straight architectural lines, comfortable composition and steady exposure.",
  exterior:
    "The camera rises slowly in a gentle crane movement, keeping the existing building centered. Natural outdoor lighting, restrained perspective shift and stable architectural proportions.",
});
export const PROPERTY_VIDEO_ROUTES = Object.freeze({
  natural: "kling/v4/image-to-video",
  premium: "bytedance/seedance-2.5/us/image-to-video",
  explore: "kling/v4/image-to-video",
  exterior: "kling/v4/image-to-video",
} as const);
export function propertyPrompt(input: unknown) {
  const style = PropertyStyle.parse(input);
  return Object.freeze({
    id: style,
    version: PROPERTY_PROMPT_VERSION,
    text: `${PROPERTY_CAMERA_PROMPTS[style]} ${PROPERTY_SOURCE_SUFFIX}`,
    provider: "fal" as const,
    endpoint: PROPERTY_VIDEO_ROUTES[style],
    fidelityGuarantee: "NONE_INDEPENDENT_REVIEW_REQUIRED" as const,
  });
}
export function propertyVideoRoute(style: PropertyVideoStyle) {
  return propertyPrompt(style).endpoint;
}
export const PROPERTY_3D_GUIDANCE =
  "Create a photorealistic, explorable scene guided by the provided property photos. Preserve the visible arrangement, openings, materials and light cues. Keep uncertain or unseen regions conservative. The result is an AI-generated spatial interpretation, not a verified survey or digital twin.";
