import { isGenerationMode } from "./modes";
import type { GenerationConfiguration, Result } from "./types";

function includes<T extends string | number>(value: unknown, options: readonly T[]): value is T {
  return options.some((option) => option === value);
}

export function parseConfiguration(value: unknown): Result<GenerationConfiguration> {
  const invalid = { ok: false, error: { code: "INVALID_CONFIGURATION", message: "Lütfen bu mod için geçerli seçenekleri kullanın." } } as const;
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid;
  const input = value as Record<string, unknown>;
  const mode = input["mode"];
  if (!isGenerationMode(mode)) return invalid;
  const common = ["mode", "durationSeconds", "aspectRatio"];
  const allowed = {
    pov: [...common, "cameraPace"],
    cinematic: [...common, "style", "captions"],
    hybrid: [...common, "povSharePercent"],
    "interactive-3d": ["mode", "quality", "daypart"],
  }[mode];
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    return { ok: false, error: { code: "UNSUPPORTED_SETTING", message: "Bu önizlemede desteklenmeyen bir seçenek var." } };
  }
  if (mode === "interactive-3d") {
    const quality = input["quality"];
    const daypart = input["daypart"];
    return includes(quality, ["balanced", "detailed"]) && includes(daypart, ["day", "dusk"])
      ? { ok: true, value: { mode, quality, daypart } } : invalid;
  }
  const durationSeconds = input["durationSeconds"];
  const aspectRatio = input["aspectRatio"];
  if (!includes(durationSeconds, [30, 60]) || !includes(aspectRatio, ["16:9", "9:16"])) return invalid;
  if (mode === "pov") {
    const cameraPace = input["cameraPace"];
    return includes(cameraPace, ["calm", "balanced"])
      ? { ok: true, value: { mode, durationSeconds, aspectRatio, cameraPace } } : invalid;
  }
  if (mode === "cinematic") {
    const style = input["style"];
    const captions = input["captions"];
    return includes(style, ["editorial", "soft"]) && typeof captions === "boolean"
      ? { ok: true, value: { mode, durationSeconds, aspectRatio, style, captions } } : invalid;
  }
  const povSharePercent = input["povSharePercent"];
  return includes(povSharePercent, [25, 50, 75])
    ? { ok: true, value: { mode, durationSeconds, aspectRatio, povSharePercent } } : invalid;
}
