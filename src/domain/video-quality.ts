import { invariant } from "./platform";
export type LabProfile = "lab-720p-15s" | "lab-1080p-30s";
export interface CaptionLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontPixels: number;
  readonly contrastRatio: number;
  readonly rasterized: true;
}
export interface ShotProvenance {
  readonly sourceId: string;
  readonly sourceSha256: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly operation:
    | "still-pan-zoom"
    | "footage-loop-cut"
    | "still-letterbox-motion"
    | "provider-image-to-video";
}
export function renderProfile(
  aspect: "16:9" | "9:16",
  seconds: number,
  lab?: LabProfile,
  composition?: "photo-clips-v54",
) {
  invariant(
    [4, 8, 16].includes(seconds) ||
      (composition === "photo-clips-v54" && seconds === 5 && !lab),
    "UNSUPPORTED_LOCAL_DURATION",
  );
  invariant(
    !lab || ["lab-720p-15s", "lab-1080p-30s"].includes(lab),
    "UNKNOWN_LAB_PROFILE",
  );
  const short =
    lab === "lab-720p-15s" ? 720 : lab === "lab-1080p-30s" ? 1080 : 360;
  return {
    id: lab ?? composition ?? "local-preview-v3",
    labOnly: !!lab,
    width: aspect === "16:9" ? (short * 16) / 9 : short,
    height: aspect === "16:9" ? short : (short * 16) / 9,
    durationSeconds:
      lab === "lab-720p-15s" ? 15 : lab === "lab-1080p-30s" ? 30 : seconds,
    maxOutputBytes: composition ? 4_194_304 : 52_428_800,
    timeoutMs: composition ? 10_000 : 90_000,
  };
}
export interface FrameStatistics {
  readonly mean: number;
  readonly deviation: number;
  readonly change: number | null;
}
export function sampleStatistics(
  gray: Uint8Array,
  width = 96,
  height = 54,
): FrameStatistics[] {
  const size = width * height;
  invariant(
    gray.length > 0 && gray.length % size === 0 && gray.length <= 6_000_000,
    "INVALID_FRAME_SAMPLES",
  );
  const result: FrameStatistics[] = [];
  for (let offset = 0; offset < gray.length; offset += size) {
    let sum = 0,
      square = 0,
      delta = 0;
    for (let i = 0; i < size; i++) {
      const v = gray[offset + i]!;
      sum += v;
      square += v * v;
      if (offset) delta += Math.abs(v - gray[offset - size + i]!);
    }
    const mean = sum / size;
    result.push({
      mean,
      deviation: Math.sqrt(Math.max(0, square / size - mean * mean)),
      change: offset ? delta / size : null,
    });
  }
  return result;
}
export function longestRun(
  samples: readonly FrameStatistics[],
  test: (s: FrameStatistics) => boolean,
) {
  let max = 0,
    current = 0;
  for (const s of samples) {
    current = test(s) ? current + 1 : 0;
    max = Math.max(max, current);
  }
  return max;
}
export function validateCaption(
  layout: CaptionLayout | null | undefined,
  width: number,
  height: number,
  required: boolean,
) {
  if (!layout) return !required;
  return (
    layout.rasterized === true &&
    layout.fontPixels >= 16 &&
    layout.contrastRatio >= 4.5 &&
    layout.x >= width * 0.04 &&
    layout.y >= height * 0.04 &&
    layout.width > 0 &&
    layout.height > 0 &&
    layout.x + layout.width <= width * 0.96 &&
    layout.y + layout.height <= height * 0.96
  );
}
export const REVIEW_DIMENSIONS = [
  "firstThreeSeconds",
  "sharpness",
  "continuity",
  "sourceFidelity",
  "readability",
  "propertyTruthfulness",
  "channelSuitability",
  "branding",
  "salesUsability",
] as const;
export const SCORE_RUBRIC_TR = {
  0: "Kullanılamaz veya kritik gerçeklik/hak ihlali var.",
  1: "Belirgin sorun; yeniden üretim gerekiyor.",
  2: "Büyük düzenleme olmadan teslim edilemez.",
  3: "Sınırda; belirtilen düzeltmeler ve insan onayı gerekli.",
  4: "Bu ölçüt için iyi; küçük düzeltme olabilir.",
  5: "Bu ölçüt için çok iyi; bağımsız inceleme yerine geçmez.",
} as const;
