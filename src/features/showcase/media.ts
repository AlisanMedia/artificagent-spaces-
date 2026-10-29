import data from "../../../fixtures/showcase-v55/registry.json";
import type { SampleRegistry } from "../../domain/showcase";
import type { PropertyVideoStyle } from "../../domain/real-estate-styles";
// Build-time verifier validates every hash, decoder, source relation and public-safe path.
export const showcaseMedia = data as SampleRegistry;
export const sampleAsset = (id: string) =>
  showcaseMedia.assets.find((a) => a.id === id);
export const videoSample = (style: PropertyVideoStyle) =>
  showcaseMedia.samples.find((s) => s.style === style);
